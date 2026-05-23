class OAuthOrganization:
    GOOGLE = "google"
    FACEGOOK = "facebook"
    ALL = [GOOGLE, FACEGOOK]
    CHOICES = [(GOOGLE, GOOGLE), (FACEGOOK, FACEGOOK)]


ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"
