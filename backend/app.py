
import pickle
import logging
import numpy as np
import pandas as pd

from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "customer_return_models.pkl"

with open(MODEL_PATH, "rb") as file:
    models = pickle.load(file)

linear_model = models["logistic_regression"]
random_forest_model = models["random_forest"]
scaler = models["scaler"]
feature_columns = models.get("feature_columns")
if not isinstance(feature_columns, (list, tuple)) or not all(
    isinstance(column, str) for column in feature_columns
):
    feature_columns = getattr(scaler, "feature_names_in_", None)
    if feature_columns is None:
        raise RuntimeError(
            "The model artifact must include feature_columns or scaler feature names."
        )
    logging.getLogger(__name__).warning(
        "Model artifact has invalid feature_columns; using the scaler's feature names."
    )
feature_columns = list(feature_columns)

categorical_columns = [
    "device_type",
    "product_category",
    "shipping_method",
    "payment_method"
]

categories = {
    col: sorted(
        feature[len(col) + 1:]
        for feature in feature_columns
        if feature.startswith(col + "_")
    )
    for col in categorical_columns
}

if any(not values for values in categories.values()):
    raise RuntimeError(
        "The model feature columns do not contain all categorical options."
    )

numeric_columns = [
    "customer_age",
    "product_price",
    "discount_percent",
    "product_rating",
    "past_purchase_count",
    "past_return_rate",
    "session_length_minutes",
    "num_product_views",
    "used_coupon"
]

non_negative_columns = numeric_columns

app = FastAPI(
    title="E-Commerce Customer Return Prediction API",
    description="Predicts the probability of an e-commerce order being returned.",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

class CustomerData(BaseModel):

    customer_age: float
    product_price: float
    discount_percent: float
    product_rating: float

    past_purchase_count: int
    past_return_rate: float

    session_length_minutes: float
    num_product_views: int

    device_type: str
    product_category: str
    shipping_method: str
    payment_method: str

    used_coupon: int

def validate_customer_data(customer_data):

    for col in numeric_columns:
        value = customer_data[col]
        if not np.isfinite(value):
            raise ValueError(
                f"{col} must be a valid finite number."
            )
        if col in non_negative_columns and value < 0:
            raise ValueError(
                f"{col} cannot be negative."
            )
    if customer_data["used_coupon"] not in [0, 1]:
        raise ValueError(
            "used_coupon must be either 0 or 1."
        )

    for col in categorical_columns:

        allowed_values = categories[col]

        if customer_data[col] not in allowed_values:
            raise ValueError(
                f"Invalid {col}: {customer_data[col]}. "
                f"Allowed values: {sorted(allowed_values)}"
            )

def preprocess_customer(customer_data):
    validate_customer_data(customer_data)
    input_df = pd.DataFrame([customer_data])
    input_df = pd.get_dummies(
        input_df,
        columns=categorical_columns,
        drop_first=False
    )
    input_df = input_df.reindex(
        columns=feature_columns,
        fill_value=0
    )
    scaled_data = scaler.transform(input_df)

    return scaled_data

def get_return_probability(model, scaled_data):

    probabilities = model.predict_proba(scaled_data)[0]
    positive_class_index = list(model.classes_).index(1)

    return float(probabilities[positive_class_index])

@app.get("/")
def home():

    return {
        "message": "E-Commerce Customer Return Prediction API is running",
        "status": "success",
        "available_models": [
            "Logistic Regression",
            "Random Forest"
        ]
    }


@app.get("/categories")
def get_categories():
    return categories

@app.post("/predict")
def predict_return(customer: CustomerData):

    try:
        customer_data = (
            customer.model_dump()
            if hasattr(customer, "model_dump")
            else customer.dict()
        )
        scaled_data = preprocess_customer(customer_data)

        lr_prediction = int(
            linear_model.predict(scaled_data)[0]
        )

        lr_probability = get_return_probability(
            linear_model,
            scaled_data
        )

        rf_prediction = int(
            random_forest_model.predict(scaled_data)[0]
        )

        rf_probability = get_return_probability(
            random_forest_model,
            scaled_data
        )

        return {

            "logistic_regression": {
                "prediction": lr_prediction,
                "result": (
                    "Likely to Return"
                    if lr_prediction == 1
                    else "Unlikely to Return"
                ),
                "return_probability": round(
                    lr_probability * 100, 2
                )
            },

            "random_forest": {
                "prediction": rf_prediction,
                "result": (
                    "Likely to Return"
                    if rf_prediction == 1
                    else "Unlikely to Return"
                ),
                "return_probability": round(
                    rf_probability * 100, 2
                )
            }

        }

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )