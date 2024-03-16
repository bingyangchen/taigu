class OAuthOrganization:
    GOOGLE = "google"
    FACEGOOK = "facebook"
    ALL = [GOOGLE, FACEGOOK]
    CHOICES = [(GOOGLE, GOOGLE), (FACEGOOK, FACEGOOK)]


AUTH_COOKIE_NAME = "token"
