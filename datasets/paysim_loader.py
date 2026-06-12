import pandas as pd


def load_paysim(csv_path):

    df = pd.read_csv(csv_path)

    return df
