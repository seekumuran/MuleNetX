import joblib
import pandas as pd

from sklearn.metrics import (
    roc_auc_score,
    precision_score,
    recall_score
)

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

y = df["label"]

pred = model.predict(X)

print(
    "Precision:",
    precision_score(y, pred)
)

print(
    "Recall:",
    recall_score(y, pred)
)

print(
    "AUC:",
    roc_auc_score(
        y,
        model.predict_proba(X)[:,1]
    )
)
