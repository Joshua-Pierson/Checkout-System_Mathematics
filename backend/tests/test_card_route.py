from main import app


def test_card_checkout_route_is_registered():
    response = app.test_client().post("/api/checkout/card", json={})

    assert response.status_code == 400
    assert response.get_json()["message"].startswith("Malformed payload.")
