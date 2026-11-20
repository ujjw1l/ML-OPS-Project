import { useState, useEffect } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";
const API_URL = `${API_BASE_URL}/predict`;
const categoryFields = [
  "device_type",
  "product_category",
  "shipping_method",
  "payment_method",
];

const initialForm = {
  customer_age: "",
  product_price: "",
  discount_percent: "",
  product_rating: "",
  past_purchase_count: "",
  past_return_rate: "",
  session_length_minutes: "",
  num_product_views: "",
  device_type: "",
  product_category: "",
  shipping_method: "",
  payment_method: "",
  used_coupon: "0",
};

const fields = [
  {
    name: "customer_age",
    label: "Customer Age",
    type: "number",
    placeholder: "e.g. 25",
    step: "1",
  },
  {
    name: "product_price",
    label: "Product Price",
    type: "number",
    placeholder: "e.g. 499",
    step: "0.01",
  },
  {
    name: "discount_percent",
    label: "Discount Percentage",
    type: "number",
    placeholder: "e.g. 10",
    step: "0.01",
  },
  {
    name: "product_rating",
    label: "Product Rating",
    type: "number",
    placeholder: "e.g. 4.2",
    step: "0.01",
  },
  {
    name: "past_purchase_count",
    label: "Past Purchase Count",
    type: "number",
    placeholder: "e.g. 5",
    step: "1",
  },
  {
    name: "past_return_rate",
    label: "Past Return Rate",
    type: "number",
    placeholder: "e.g. 0.2",
    step: "0.01",
  },
  {
    name: "session_length_minutes",
    label: "Session Length (Minutes)",
    type: "number",
    placeholder: "e.g. 12",
    step: "0.01",
  },
  {
    name: "num_product_views",
    label: "Number of Product Views",
    type: "number",
    placeholder: "e.g. 8",
    step: "1",
  },
];

function ProbabilityBar({ value }) {
  return (
    <div className="probability-track">
      <div
        className="probability-fill"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function ModelCard({ title, data, description }) {
  if (!data) return null;

  const isReturn = data.prediction === 1;

  return (
    <div className="model-card">
      <div className="model-heading">
        <div>
          <p className="eyebrow">MACHINE LEARNING MODEL</p>
          <h3>{title}</h3>
        </div>
        <span className="model-icon">AI</span>
      </div>

      <p className="model-description">{description}</p>

      <div className="probability-number">
        {data.return_probability.toFixed(2)}%
      </div>

      <p className="muted">Estimated return probability</p>

      <ProbabilityBar value={data.return_probability} />

      <div className="prediction-status">
        <span className={isReturn ? "status-return" : "status-safe"}>
          {data.result}
        </span>
        <span className="prediction-label">Predicted class: {data.prediction}</span>
      </div>
    </div>
  );
}

function App() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState("");

  const [categories, setCategories] = useState({
    device_type: [],
    product_category: [],
    shipping_method: [],
    payment_method: []
  });

  useEffect(() => {
    fetch(`${API_BASE_URL}/categories`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load categories (HTTP ${response.status}).`);
        }
        return response.json();
      })
      .then((data) => {
        const loadedCategories = Object.fromEntries(
          categoryFields.map((field) => {
            if (
              !Array.isArray(data[field]) ||
              data[field].length === 0 ||
              data[field].some((category) => typeof category !== "string")
            ) {
              throw new Error(`The backend returned no valid options for ${field.replaceAll("_", " ")}.`);
            }
            return [field, data[field]];
          })
        );
        setCategories(loadedCategories);
      })
      .catch((error) => {
        console.error("Category loading error:", error);
        setCategoryError(error.message);
      })
      .finally(() => {
        setCategoriesLoading(false);
      });
  }, []);


  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setResult(null);

    // Validate that all fields have values
    for (const [key, value] of Object.entries(form)) {
      if (value === "" || value === null) {
        setError(`Please enter ${key.replaceAll("_", " ")}.`);
        return;
      }
    }

    // Convert numerical form values from strings to numbers
    const customerData = {
      ...form,
      customer_age: Number(form.customer_age),
      product_price: Number(form.product_price),
      discount_percent: Number(form.discount_percent),
      product_rating: Number(form.product_rating),
      past_purchase_count: Number(form.past_purchase_count),
      past_return_rate: Number(form.past_return_rate),
      session_length_minutes: Number(form.session_length_minutes),
      num_product_views: Number(form.num_product_views),
      used_coupon: Number(form.used_coupon),
    };

    // Frontend validation
    for (const [key, value] of Object.entries(customerData)) {
      if (typeof value === "number" && !Number.isFinite(value)) {
        setError(`${key.replaceAll("_", " ")} must be a valid number.`);
        return;
      }
    }

    const numericFields = [
      "customer_age",
      "product_price",
      "discount_percent",
      "product_rating",
      "past_purchase_count",
      "past_return_rate",
      "session_length_minutes",
      "num_product_views",
    ];

    for (const field of numericFields) {
      if (customerData[field] < 0) {
        setError(`${field.replaceAll("_", " ")} cannot be negative.`);
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(customerData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Prediction request failed.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err.message.includes("Failed to fetch")
          ? "Cannot connect to the backend. Make sure FastAPI is running on port 8000."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(initialForm);
    setResult(null);
    setError("");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">CR</div>
          <div>
            <h2>ReturnSense</h2>
            <p>ML Prediction System</p>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <div className="nav-item active">
          <span>▦</span> Dashboard
        </div>

        <div className="nav-item">
          <span>◉</span> Predictions
        </div>

        <div className="sidebar-bottom">
          <div className="connection-indicator">
            <span className="online-dot" />
            Backend API
            <small>Configure at localhost:8000</small>
          </div>
          <p className="sidebar-footer">E-Commerce Return Prediction</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / Dashboard</p>
            <h1>Customer Return Prediction</h1>
            <p className="subtitle">
              Analyse customer information and predict product returns using
              two machine learning models.
            </p>
          </div>

          <div className="api-status">
            <span className="online-dot" />
            API configured
          </div>
        </header>

        <section className="intro-card">
          <div>
            <p className="eyebrow">PREDICTIVE ANALYTICS</p>
            <h2>Understand return behaviour before it happens.</h2>
            <p>
              Enter the customer's details below to generate predictions from
              Logistic Regression and Random Forest.
            </p>
          </div>
          <div className="intro-symbol">↗</div>
        </section>

        <section className="workspace-grid">
          <div className="form-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CUSTOMER INFORMATION</p>
                <h2>Enter customer details</h2>
              </div>
              <span className="step-number">01</span>
            </div>

            <form onSubmit={handleSubmit}>
              <h3 className="form-section-title">Numerical information</h3>

              <div className="form-grid">
                {fields.map((field) => (
                  <div className="form-group" key={field.name}>
                    <label htmlFor={field.name}>{field.label}</label>
                    <input
                      id={field.name}
                      name={field.name}
                      type={field.type}
                      step={field.step}
                      min="0"
                      placeholder={field.placeholder}
                      value={form[field.name]}
                      onChange={handleChange}
                      required
                    />
                  </div>
                ))}
              </div>

              <div className="form-divider" />

              <h3 className="form-section-title">Categorical information</h3>

              {categoryError && (
                <div className="error-message" role="alert">
                  <strong>Category options unavailable:</strong> {categoryError}
                </div>
              )}

              <div className="form-grid">

                {/* Device Type */}
                <div className="form-group">
                  <label htmlFor="device_type">Device Type</label>
                  <select
                    id="device_type"
                    name="device_type"
                    value={form.device_type}
                    onChange={handleChange}
                    required
                    disabled={categoriesLoading || Boolean(categoryError)}
                  >
                    <option value="">
                      {categoriesLoading ? "Loading options..." : "Select Device Type"}
                    </option>
                    {categories.device_type.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Product Category */}
                <div className="form-group">
                  <label htmlFor="product_category">Product Category</label>
                  <select
                    id="product_category"
                    name="product_category"
                    value={form.product_category}
                    onChange={handleChange}
                    required
                    disabled={categoriesLoading || Boolean(categoryError)}
                  >
                    <option value="">
                      {categoriesLoading ? "Loading options..." : "Select Product Category"}
                    </option>
                    {categories.product_category.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shipping Method */}
                <div className="form-group">
                  <label htmlFor="shipping_method">Shipping Method</label>
                  <select
                    id="shipping_method"
                    name="shipping_method"
                    value={form.shipping_method}
                    onChange={handleChange}
                    required
                    disabled={categoriesLoading || Boolean(categoryError)}
                  >
                    <option value="">
                      {categoriesLoading ? "Loading options..." : "Select Shipping Method"}
                    </option>
                    {categories.shipping_method.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Method */}
                <div className="form-group">
                  <label htmlFor="payment_method">Payment Method</label>
                  <select
                    id="payment_method"
                    name="payment_method"
                    value={form.payment_method}
                    onChange={handleChange}
                    required
                    disabled={categoriesLoading || Boolean(categoryError)}
                  >
                    <option value="">
                      {categoriesLoading ? "Loading options..." : "Select Payment Method"}
                    </option>
                    {categories.payment_method.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>


                <div className="form-group">
                  <label htmlFor="used_coupon">Coupon Used?</label>
                  <select
                    id="used_coupon"
                    name="used_coupon"
                    value={form.used_coupon}
                    onChange={handleChange}
                  >
                    <option value="0">No</option>
                    <option value="1">Yes</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  <strong>Error:</strong> {error}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="reset-button"
                  onClick={resetForm}
                >
                  Reset
                </button>

                <button
                  type="submit"
                  className="predict-button"
                  disabled={loading}
                >
                  {loading ? "Analysing..." : "Generate Prediction →"}
                </button>
              </div>
            </form>
          </div>

          <div className="results-column">
            <div className="results-heading">
              <div>
                <p className="eyebrow">MODEL OUTPUT</p>
                <h2>Prediction results</h2>
              </div>
              <span className="step-number">02</span>
            </div>

            {!result && (
              <div className="empty-results">
                <div className="empty-icon">◎</div>
                <h3>Waiting for customer data</h3>
                <p>
                  Complete the form and click Generate Prediction to see the
                  results from both machine learning models.
                </p>
              </div>
            )}

            {result && (
              <>
                <ModelCard
                  title="Logistic Regression"
                  description="Linear classification model"
                  data={result.logistic_regression}
                />

                <ModelCard
                  title="Random Forest"
                  description="Ensemble classification model"
                  data={result.random_forest}
                />

                <div className="comparison-card">
                  <p className="eyebrow">MODEL COMPARISON</p>
                  <h3>Return probability difference</h3>

                  <div className="comparison-number">
                    {Math.abs(
                      result.logistic_regression.return_probability -
                      result.random_forest.return_probability
                    ).toFixed(2)}
                    <span>%</span>
                  </div>

                  <p className="muted">
                    Absolute difference between the two model estimates.
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        <footer className="page-footer">
          E-Commerce Customer Return Prediction System · Machine Learning
          Project
        </footer>
      </main>
    </div>
  );
}

export default App;