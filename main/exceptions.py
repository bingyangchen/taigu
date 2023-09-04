class DuplicatedEmailError(Exception):
    def __str__(self):
        return "Duplicated Email"


class DataNotSufficientError(Exception):
    def __str__(self):
        return "Data Not Sufficient"


class WrongPasswordError(Exception):
    def __str__(self):
        return "Wrong Password"
