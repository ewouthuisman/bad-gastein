-- Seed data: group code, the house, standard polls for the ski days, house info.

insert into public.app_config (key, value) values ('group_code', '[PLACEHOLDER]')
on conflict (key) do nothing;

-- Coordinates approximate (just below the Graukogel valley station); corrected from OSM in the graph build.
insert into public.places (name, kind, lat, lng, website)
values ('Panorama Spa Lodges (Das Schiller)', 'house', 47.1133, 13.1381, null);

-- Standard polls for Mon 1 Mar – Fri 5 Mar 2027.
insert into public.polls (day, kind)
select d::date, k
from generate_series('2027-03-01'::date, '2027-03-05'::date, interval '1 day') as d,
     unnest(array['early_ski', 'lunch_place', 'lunch_time', 'apres_place', 'apres_or_spa', 'dinner_place']) as k;

insert into public.poll_options (poll_id, label, value)
select p.id, o.label, o.value
from public.polls p
join (values
  ('early_ski', 'Vroeg mee', 'early'),
  ('early_ski', 'Uitslapen', 'late'),
  ('lunch_time', '11:30', '11:30'),
  ('lunch_time', '12:00', '12:00'),
  ('lunch_time', '12:30', '12:30'),
  ('lunch_time', '13:00', '13:00'),
  ('lunch_time', '13:30', '13:30'),
  ('apres_or_spa', 'Après-ski', 'apres'),
  ('apres_or_spa', 'Spa/zwembad', 'spa'),
  ('dinner_place', 'Thuis koken', 'home')
) as o(kind, label, value) on o.kind = p.kind;

insert into public.house_info (section, title, markdown, sort) values
('algemeen', 'Het huis',
 E'**Panorama Spa Lodges (Das Schiller)**\nKötschachtaler Straße 5, 5640 Bad Gastein, Oostenrijk\n\nLigt direct onder het dalstation van de **Graukogel**.\n\nType accommodatie: [PLACEHOLDER]\nAantal slaapkamers / badkamers: [PLACEHOLDER]', 10),
('inbegrepen', 'Wat is inbegrepen',
 E'Volgens openbare bronnen (nog te bevestigen met onze boeking):\n\n- Gratis gebruik van de wellness (zie Zwembad & spa)\n- Gratis wifi\n- Gratis parkeren\n- Skiruimte\n\nBeddengoed / handdoeken: [PLACEHOLDER]\nEindschoonmaak: [PLACEHOLDER]', 20),
('inchecken', 'Inchecken & uitchecken',
 E'Inchecken: [PLACEHOLDER]\nUitchecken: [PLACEHOLDER]\nSleutel / sleutelkluis: [PLACEHOLDER]', 30),
('kosten', 'Kosten & borg',
 E'Borg: [PLACEHOLDER]\nToeristenbelasting: [PLACEHOLDER]\nSchoonmaakkosten: [PLACEHOLDER]', 40),
('wellness', 'Zwembad & spa',
 E'Gasten hebben gratis toegang tot de wellness:\n\n- Panorama-binnenzwembad\n- Alpensauna\n- Infraroodcabine\n- Rustruimte en ligweide\n\nOpeningstijden zwembad: [PLACEHOLDER]\nOpeningstijden sauna/spa: [PLACEHOLDER]\nVoorwaarden (badkleding, handdoeken, leeftijd, reserveren): [PLACEHOLDER]', 50),
('regels', 'Huisregels',
 E'[PLACEHOLDER]', 60),
('contact', 'Contact',
 E'Telefoon: [PLACEHOLDER]\nE-mail: [PLACEHOLDER]\nWifi-netwerk / wachtwoord: [PLACEHOLDER]', 70),
('booking', 'Boeking',
 E'[PLACEHOLDER]', 80)
on conflict (section) do nothing;
