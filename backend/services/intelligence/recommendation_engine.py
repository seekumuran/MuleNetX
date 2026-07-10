from random import choice


class RecommendationEngine:

    def __init__(self):

        self.recommendations = [

            {
                "title": "Freeze High Risk Accounts",
                "description": "12 accounts exceeded fraud threshold.",
                "priority": "CRITICAL",
                "confidence": 94,
                "impact": "₹2.31 Cr Prevented"
            },

            {
                "title": "Increase Regional Monitoring",
                "description": "Transaction velocity increasing in Karnataka.",
                "priority": "HIGH",
                "confidence": 91,
                "impact": "Reduce fraud by 18%"
            },

            {
                "title": "Escalate Cluster Investigation",
                "description": "Community Cluster-17 expanded by 22%.",
                "priority": "HIGH",
                "confidence": 96,
                "impact": "Prevent ring propagation"
            },

            {
                "title": "Retrain Fraud Model",
                "description": "Concept drift detected.",
                "priority": "MEDIUM",
                "confidence": 88,
                "impact": "Increase model accuracy"
            }

        ]

    def generate(self):

        return choice(self.recommendations)


engine = RecommendationEngine()
