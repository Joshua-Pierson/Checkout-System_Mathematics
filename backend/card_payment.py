"""Simulated card approval for the story "As a student, I can pay with a card".

No real bank is contacted. Rules:
  * The number must be 13-19 digits (spaces/dashes are ignored).
  * It must pass the Luhn check (the checksum real card numbers use).
  * TEST DECLINE: any card ending in 0002 is declined, so the team can
    demo the "card declined" screen. Example: 4000 0000 0000 0002.
  * Approved card for demos: 4242 4242 4242 4242.
Only the last 4 digits are ever returned or saved.
"""
DECLINE_SUFFIX = "0002"


class CardDeclined(Exception):
    """The simulated bank said no."""


def _luhn_ok(digits):
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def authorize_card(card_number):
    """Return the last 4 digits if approved; raise ValueError/CardDeclined if not."""
    if not isinstance(card_number, str):
        raise ValueError("card_number is required for card payments")
    digits = card_number.replace(" ", "").replace("-", "")
    if not digits.isdigit() or not 13 <= len(digits) <= 19:
        raise ValueError("card_number must be 13-19 digits")
    if not _luhn_ok(digits):
        raise ValueError("card_number is not a valid card number")
    if digits.endswith(DECLINE_SUFFIX):
        raise CardDeclined("Card declined")
    return digits[-4:]