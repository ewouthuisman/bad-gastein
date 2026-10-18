-- Links people add are rendered as hrefs; only allow http(s) so a "javascript:" link can't run code.
alter table public.places
  add constraint places_website_http check (website is null or website ~* '^https?://'),
  add constraint places_menu_url_http check (menu_url is null or menu_url ~* '^https?://');
