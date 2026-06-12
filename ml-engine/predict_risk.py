import joblib
import pandas as pd


model = joblib.load(
    "ml-engine/models/xgb_fraud.pkl"
)


def predict(df):

    features = df.drop(
        columns=["account_id", "label"]
    )

    probabilities = model.predict_proba(
        features
    )[:, 1]

    df["risk_score"] = probabilities

    return df
