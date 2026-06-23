import pytest


@pytest.mark.skip(reason="Integration tests require PostgreSQL testcontainer setup.")
def test_integration_placeholder() -> None:
    pass
