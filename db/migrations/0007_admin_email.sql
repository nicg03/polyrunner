-- Rende admin l'account con questa email, se esiste già.
update users set is_admin = true where lower(email) = 'niccologatti3@gmail.com';
