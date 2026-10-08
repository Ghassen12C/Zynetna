-- Every Tunisian governorate, with its main towns, so a business anywhere in
-- the country can list its real city. Additive and idempotent: rows that
-- already exist (by slug or name) are left untouched.

INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_tunis', 'Tunis', 'تونس', 'tunis') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_ariana', 'Ariana', 'أريانة', 'ariana') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_ben-arous', 'Ben Arous', 'بن عروس', 'ben-arous') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_manouba', 'Manouba', 'منوبة', 'manouba') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_nabeul', 'Nabeul', 'نابل', 'nabeul') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_zaghouan', 'Zaghouan', 'زغوان', 'zaghouan') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_bizerte', 'Bizerte', 'بنزرت', 'bizerte') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_beja', 'Béja', 'باجة', 'beja') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_jendouba', 'Jendouba', 'جندوبة', 'jendouba') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_le-kef', 'Le Kef', 'الكاف', 'le-kef') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_siliana', 'Siliana', 'سليانة', 'siliana') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_sousse', 'Sousse', 'سوسة', 'sousse') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_monastir', 'Monastir', 'المنستير', 'monastir') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_mahdia', 'Mahdia', 'المهدية', 'mahdia') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_kairouan', 'Kairouan', 'القيروان', 'kairouan') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_kasserine', 'Kasserine', 'القصرين', 'kasserine') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_sidi-bouzid', 'Sidi Bouzid', 'سيدي بوزيد', 'sidi-bouzid') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_sfax', 'Sfax', 'صفاقس', 'sfax') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_gafsa', 'Gafsa', 'قفصة', 'gafsa') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_tozeur', 'Tozeur', 'توزر', 'tozeur') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_kebili', 'Kebili', 'قبلي', 'kebili') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_gabes', 'Gabès', 'قابس', 'gabes') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_medenine', 'Médenine', 'مدنين', 'medenine') ON CONFLICT DO NOTHING;
INSERT INTO "Governorate" ("id", "name", "nameAr", "slug") VALUES ('gov_tataouine', 'Tataouine', 'تطاوين', 'tataouine') ON CONFLICT DO NOTHING;

INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_tunis', g."id", 'Tunis', 'تونس', 'tunis', 36.8065, 10.1815 FROM "Governorate" g WHERE g."slug" = 'tunis'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_la-marsa', g."id", 'La Marsa', 'المرسى', 'la-marsa', 36.8781, 10.3247 FROM "Governorate" g WHERE g."slug" = 'tunis'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_le-bardo', g."id", 'Le Bardo', 'باردو', 'le-bardo', 36.8092, 10.14 FROM "Governorate" g WHERE g."slug" = 'tunis'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_carthage', g."id", 'Carthage', 'قرطاج', 'carthage', 36.8528, 10.3294 FROM "Governorate" g WHERE g."slug" = 'tunis'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_berges-du-lac', g."id", 'Les Berges du Lac', 'ضفاف البحيرة', 'berges-du-lac', 36.838, 10.24 FROM "Governorate" g WHERE g."slug" = 'tunis'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_la-goulette', g."id", 'La Goulette', 'حلق الوادي', 'la-goulette', 36.8181, 10.305 FROM "Governorate" g WHERE g."slug" = 'tunis'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_ariana', g."id", 'Ariana', 'أريانة', 'ariana', 36.8625, 10.1956 FROM "Governorate" g WHERE g."slug" = 'ariana'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_raoued', g."id", 'Raoued', 'رواد', 'raoued', 36.9167, 10.1833 FROM "Governorate" g WHERE g."slug" = 'ariana'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_la-soukra', g."id", 'La Soukra', 'سكرة', 'la-soukra', 36.8722, 10.2361 FROM "Governorate" g WHERE g."slug" = 'ariana'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_ben-arous', g."id", 'Ben Arous', 'بن عروس', 'ben-arous', 36.7533, 10.2317 FROM "Governorate" g WHERE g."slug" = 'ben-arous'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_ezzahra', g."id", 'Ezzahra', 'الزهراء', 'ezzahra', 36.7406, 10.3092 FROM "Governorate" g WHERE g."slug" = 'ben-arous'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_rades', g."id", 'Radès', 'رادس', 'rades', 36.7686, 10.2753 FROM "Governorate" g WHERE g."slug" = 'ben-arous'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_hammam-lif', g."id", 'Hammam Lif', 'حمام الأنف', 'hammam-lif', 36.7272, 10.3417 FROM "Governorate" g WHERE g."slug" = 'ben-arous'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_el-mourouj', g."id", 'El Mourouj', 'المروج', 'el-mourouj', 36.7303, 10.2072 FROM "Governorate" g WHERE g."slug" = 'ben-arous'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_megrine', g."id", 'Mégrine', 'مقرين', 'megrine', 36.7703, 10.2336 FROM "Governorate" g WHERE g."slug" = 'ben-arous'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_manouba', g."id", 'Manouba', 'منوبة', 'manouba', 36.8081, 10.0972 FROM "Governorate" g WHERE g."slug" = 'manouba'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_oued-ellil', g."id", 'Oued Ellil', 'وادي الليل', 'oued-ellil', 36.8333, 10.0333 FROM "Governorate" g WHERE g."slug" = 'manouba'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_nabeul', g."id", 'Nabeul', 'نابل', 'nabeul', 36.4561, 10.7376 FROM "Governorate" g WHERE g."slug" = 'nabeul'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_hammamet', g."id", 'Hammamet', 'الحمامات', 'hammamet', 36.4, 10.6167 FROM "Governorate" g WHERE g."slug" = 'nabeul'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_kelibia', g."id", 'Kélibia', 'قليبية', 'kelibia', 36.8478, 11.0939 FROM "Governorate" g WHERE g."slug" = 'nabeul'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_korba', g."id", 'Korba', 'قربة', 'korba', 36.5786, 10.8586 FROM "Governorate" g WHERE g."slug" = 'nabeul'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_menzel-temime', g."id", 'Menzel Temime', 'منزل تميم', 'menzel-temime', 36.7814, 10.9875 FROM "Governorate" g WHERE g."slug" = 'nabeul'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_zaghouan', g."id", 'Zaghouan', 'زغوان', 'zaghouan', 36.4029, 10.1429 FROM "Governorate" g WHERE g."slug" = 'zaghouan'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_el-fahs', g."id", 'El Fahs', 'الفحص', 'el-fahs', 36.3747, 9.9067 FROM "Governorate" g WHERE g."slug" = 'zaghouan'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_bizerte', g."id", 'Bizerte', 'بنزرت', 'bizerte', 37.2746, 9.8739 FROM "Governorate" g WHERE g."slug" = 'bizerte'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_menzel-bourguiba', g."id", 'Menzel Bourguiba', 'منزل بورقيبة', 'menzel-bourguiba', 37.1531, 9.7861 FROM "Governorate" g WHERE g."slug" = 'bizerte'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_mateur', g."id", 'Mateur', 'ماطر', 'mateur', 37.04, 9.665 FROM "Governorate" g WHERE g."slug" = 'bizerte'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_beja', g."id", 'Béja', 'باجة', 'beja', 36.7256, 9.1817 FROM "Governorate" g WHERE g."slug" = 'beja'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_medjez-el-bab', g."id", 'Medjez el-Bab', 'مجاز الباب', 'medjez-el-bab', 36.65, 9.61 FROM "Governorate" g WHERE g."slug" = 'beja'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_jendouba', g."id", 'Jendouba', 'جندوبة', 'jendouba', 36.5011, 8.7802 FROM "Governorate" g WHERE g."slug" = 'jendouba'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_tabarka', g."id", 'Tabarka', 'طبرقة', 'tabarka', 36.9544, 8.7581 FROM "Governorate" g WHERE g."slug" = 'jendouba'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_ain-draham', g."id", 'Aïn Draham', 'عين دراهم', 'ain-draham', 36.779, 8.687 FROM "Governorate" g WHERE g."slug" = 'jendouba'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_le-kef', g."id", 'Le Kef', 'الكاف', 'le-kef', 36.1822, 8.7147 FROM "Governorate" g WHERE g."slug" = 'le-kef'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_siliana', g."id", 'Siliana', 'سليانة', 'siliana', 36.0849, 9.3708 FROM "Governorate" g WHERE g."slug" = 'siliana'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_makthar', g."id", 'Makthar', 'مكثر', 'makthar', 35.858, 9.205 FROM "Governorate" g WHERE g."slug" = 'siliana'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_sousse', g."id", 'Sousse', 'سوسة', 'sousse', 35.8256, 10.6084 FROM "Governorate" g WHERE g."slug" = 'sousse'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_hammam-sousse', g."id", 'Hammam Sousse', 'حمام سوسة', 'hammam-sousse', 35.8611, 10.5944 FROM "Governorate" g WHERE g."slug" = 'sousse'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_msaken', g."id", 'Msaken', 'مساكن', 'msaken', 35.7333, 10.5833 FROM "Governorate" g WHERE g."slug" = 'sousse'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_akouda', g."id", 'Akouda', 'أكودة', 'akouda', 35.8711, 10.5703 FROM "Governorate" g WHERE g."slug" = 'sousse'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_kalaa-kebira', g."id", 'Kalâa Kebira', 'القلعة الكبرى', 'kalaa-kebira', 35.8667, 10.5333 FROM "Governorate" g WHERE g."slug" = 'sousse'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_monastir', g."id", 'Monastir', 'المنستير', 'monastir', 35.778, 10.8262 FROM "Governorate" g WHERE g."slug" = 'monastir'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_ksar-hellal', g."id", 'Ksar Hellal', 'قصر هلال', 'ksar-hellal', 35.6436, 10.8906 FROM "Governorate" g WHERE g."slug" = 'monastir'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_moknine', g."id", 'Moknine', 'المكنين', 'moknine', 35.6253, 10.9031 FROM "Governorate" g WHERE g."slug" = 'monastir'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_jemmal', g."id", 'Jemmal', 'جمال', 'jemmal', 35.6236, 10.7594 FROM "Governorate" g WHERE g."slug" = 'monastir'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_mahdia', g."id", 'Mahdia', 'المهدية', 'mahdia', 35.5047, 11.0622 FROM "Governorate" g WHERE g."slug" = 'mahdia'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_ksour-essef', g."id", 'Ksour Essef', 'قصور الساف', 'ksour-essef', 35.418, 10.994 FROM "Governorate" g WHERE g."slug" = 'mahdia'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_el-jem', g."id", 'El Jem', 'الجم', 'el-jem', 35.2964, 10.7128 FROM "Governorate" g WHERE g."slug" = 'mahdia'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_kairouan', g."id", 'Kairouan', 'القيروان', 'kairouan', 35.6781, 10.0963 FROM "Governorate" g WHERE g."slug" = 'kairouan'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_kasserine', g."id", 'Kasserine', 'القصرين', 'kasserine', 35.1676, 8.8365 FROM "Governorate" g WHERE g."slug" = 'kasserine'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_sbeitla', g."id", 'Sbeitla', 'سبيطلة', 'sbeitla', 35.2364, 9.1214 FROM "Governorate" g WHERE g."slug" = 'kasserine'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_sidi-bouzid', g."id", 'Sidi Bouzid', 'سيدي بوزيد', 'sidi-bouzid', 35.0382, 9.4849 FROM "Governorate" g WHERE g."slug" = 'sidi-bouzid'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_sfax', g."id", 'Sfax', 'صفاقس', 'sfax', 34.7406, 10.7603 FROM "Governorate" g WHERE g."slug" = 'sfax'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_sakiet-ezzit', g."id", 'Sakiet Ezzit', 'ساقية الزيت', 'sakiet-ezzit', 34.806, 10.762 FROM "Governorate" g WHERE g."slug" = 'sfax'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_sakiet-eddaier', g."id", 'Sakiet Eddaier', 'ساقية الدائر', 'sakiet-eddaier', 34.7997, 10.7742 FROM "Governorate" g WHERE g."slug" = 'sfax'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_thyna', g."id", 'Thyna', 'طينة', 'thyna', 34.6897, 10.7064 FROM "Governorate" g WHERE g."slug" = 'sfax'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_kerkennah', g."id", 'Kerkennah', 'قرقنة', 'kerkennah', 34.7128, 11.195 FROM "Governorate" g WHERE g."slug" = 'sfax'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_gafsa', g."id", 'Gafsa', 'قفصة', 'gafsa', 34.425, 8.7842 FROM "Governorate" g WHERE g."slug" = 'gafsa'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_metlaoui', g."id", 'Métlaoui', 'المتلوي', 'metlaoui', 34.3214, 8.4014 FROM "Governorate" g WHERE g."slug" = 'gafsa'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_tozeur', g."id", 'Tozeur', 'توزر', 'tozeur', 33.9197, 8.1335 FROM "Governorate" g WHERE g."slug" = 'tozeur'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_nefta', g."id", 'Nefta', 'نفطة', 'nefta', 33.8733, 7.8775 FROM "Governorate" g WHERE g."slug" = 'tozeur'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_kebili', g."id", 'Kebili', 'قبلي', 'kebili', 33.7044, 8.969 FROM "Governorate" g WHERE g."slug" = 'kebili'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_douz', g."id", 'Douz', 'دوز', 'douz', 33.4572, 9.0203 FROM "Governorate" g WHERE g."slug" = 'kebili'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_gabes', g."id", 'Gabès', 'قابس', 'gabes', 33.8815, 10.0982 FROM "Governorate" g WHERE g."slug" = 'gabes'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_mareth', g."id", 'Mareth', 'مارث', 'mareth', 33.6333, 10.2833 FROM "Governorate" g WHERE g."slug" = 'gabes'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_djerba', g."id", 'Djerba — Houmt Souk', 'جربة — حومة السوق', 'djerba', 33.8756, 10.8571 FROM "Governorate" g WHERE g."slug" = 'medenine'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_djerba-midoun', g."id", 'Djerba — Midoun', 'جربة — ميدون', 'djerba-midoun', 33.8081, 10.9922 FROM "Governorate" g WHERE g."slug" = 'medenine'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_medenine-ville', g."id", 'Médenine', 'مدنين', 'medenine-ville', 33.3547, 10.5053 FROM "Governorate" g WHERE g."slug" = 'medenine'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_zarzis', g."id", 'Zarzis', 'جرجيس', 'zarzis', 33.5039, 11.1122 FROM "Governorate" g WHERE g."slug" = 'medenine'
ON CONFLICT DO NOTHING;
INSERT INTO "City" ("id", "governorateId", "name", "nameAr", "slug", "latitude", "longitude")
SELECT 'city_tataouine', g."id", 'Tataouine', 'تطاوين', 'tataouine', 32.9297, 10.4518 FROM "Governorate" g WHERE g."slug" = 'tataouine'
ON CONFLICT DO NOTHING;
