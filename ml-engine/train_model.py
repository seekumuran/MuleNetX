import joblib
import pandas as pd

from xgboost import XGBClassifier

from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report


df = pd.read_csv(
    "datasets/account_features.csv"
)

X = df.drop(
    columns=["account_id", "label"]
)

y = df["label"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

model = XGBClassifier(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.05,
    eval_metric="logloss"
)

model.fit(
    X_train,
    y_train
)

preds = model.predict(X_test)

print(
    classification_report(
        y_test,
        preds
    )
)

joblib.dump(
    model,
    "ml-engine/models/xgb_fraud.pkl"
)

print("Model Saved")
