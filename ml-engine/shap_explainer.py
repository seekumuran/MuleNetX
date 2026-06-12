import shap
import joblib
import pandas as pd


model = joblib.load(
    "ml-engine/models/xgb_fraud.pkl"
)

df = pd.read_csv(
    "datasets/account_features.csv"
)

X = df.drop(
    columns=[
        "account_id",
        "label"
    ]
)

explainer = shap.TreeExplainer(
    model
)

values = explainer.shap_values(
    X[:100]
)

shap.summary_plot(
    values,
    X[:100]
)
