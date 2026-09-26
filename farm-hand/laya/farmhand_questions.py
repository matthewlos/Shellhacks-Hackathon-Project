"""The one typed question Farm Hand asks Laya. Shared by training, eval and the live server."""
LABELS = ["water", "wait_rain", "wait_moist"]
QUESTIONS = {
    "action": {
        "type": "choice",
        "instructions": "You irrigate a Florida vegetable field. From the soil probe, the weather and the rain forecast, pick the move that keeps the crop out of stress while wasting the least water.",
        "criteria": {
            "water": "the soil is near or past the stress line and the rain coming will not cover it, so irrigate now",
            "wait_rain": "the soil is getting dry but enough real rain is coming in the next 24 hours to refill it, so hold off",
            "wait_moist": "the soil still has plenty of water for the crop, so watering now would only drain past the roots",
        },
    }
}
