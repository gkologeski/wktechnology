-- USAGE permits identity functions only; it grants no table access or role inheritance.
GRANT USAGE ON SCHEMA auth TO techerp_api_subject;
NOTIFY pgrst,'reload schema';
