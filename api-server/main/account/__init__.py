class OAuthOrganization:
    GOOGLE = "google"
    FACEGOOK = "facebook"
    ALL = [GOOGLE, FACEGOOK]
    CHOICES = [(GOOGLE, GOOGLE), (FACEGOOK, FACEGOOK)]


ACCESS_COOKIE_NAME = "__Host-access_token"
REFRESH_COOKIE_NAME = "__Secure-refresh_token"
