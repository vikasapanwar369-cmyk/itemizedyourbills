
-- ============================================================
-- 1. Taxonomy tables
-- ============================================================
CREATE TABLE public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  label       text NOT NULL,
  emoji       text NOT NULL DEFAULT '📦',
  sort_order  int  NOT NULL DEFAULT 100,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO authenticated, anon;
GRANT ALL    ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories readable by all"
  ON public.categories FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE TABLE public.subcategories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  key          text NOT NULL,
  label        text NOT NULL,
  keywords     text[] NOT NULL DEFAULT '{}',
  sort_order   int  NOT NULL DEFAULT 100,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, key)
);

GRANT SELECT ON public.subcategories TO authenticated, anon;
GRANT ALL    ON public.subcategories TO service_role;

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subcategories readable by all"
  ON public.subcategories FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE INDEX idx_subcategories_category_id ON public.subcategories(category_id);

-- ============================================================
-- 2. Items: audit + FK columns
-- ============================================================
ALTER TABLE public.items
  ADD COLUMN category_id         uuid REFERENCES public.categories(id)    ON DELETE SET NULL,
  ADD COLUMN subcategory_id      uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
  ADD COLUMN category_confidence numeric NOT NULL DEFAULT 0,
  ADD COLUMN categorized_by      text    NOT NULL DEFAULT 'ai'
    CHECK (categorized_by IN ('ai','user','rule','unknown')),
  ADD COLUMN categorized_at      timestamptz NOT NULL DEFAULT now();

CREATE INDEX idx_items_category_id    ON public.items(category_id);
CREATE INDEX idx_items_subcategory_id ON public.items(subcategory_id);

-- ============================================================
-- 3. Bills: internationalization + money breakdown
-- ============================================================
ALTER TABLE public.bills
  ADD COLUMN currency text NOT NULL DEFAULT 'INR',
  ADD COLUMN country  text NOT NULL DEFAULT 'IN',
  ADD COLUMN locale   text NOT NULL DEFAULT 'en-IN',
  ADD COLUMN subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN tax      numeric NOT NULL DEFAULT 0,
  ADD COLUMN discount numeric NOT NULL DEFAULT 0;

-- ============================================================
-- 4. Seed taxonomy (Amazon/Flipkart-grade, international)
-- ============================================================
INSERT INTO public.categories (key, label, emoji, sort_order) VALUES
  ('grocery',        'Grocery & Staples',      '🛒', 10),
  ('produce',        'Fruits & Vegetables',    '🥬', 20),
  ('dairy',          'Dairy & Eggs',           '🥛', 30),
  ('beverages',      'Beverages',              '🥤', 40),
  ('snacks',         'Snacks & Confectionery', '🍫', 50),
  ('bakery',         'Bakery',                 '🥐', 60),
  ('meat',           'Meat & Seafood',         '🥩', 70),
  ('frozen',         'Frozen Foods',           '🧊', 80),
  ('hygiene',        'Personal Care & Hygiene','🧴', 90),
  ('beauty',         'Beauty & Cosmetics',     '💄', 100),
  ('household',      'Household Supplies',     '🧹', 110),
  ('baby',           'Baby Care',              '🍼', 120),
  ('pets',           'Pet Supplies',           '🐾', 130),
  ('medicine',       'Health & Medicine',      '💊', 140),
  ('fuel',           'Fuel',                   '⛽', 150),
  ('clothing',       'Clothing & Apparel',     '👕', 160),
  ('footwear',       'Footwear',               '👟', 170),
  ('electronics',    'Electronics',            '🔌', 180),
  ('mobile',         'Mobile & Accessories',   '📱', 190),
  ('appliances',     'Home Appliances',        '🔧', 200),
  ('home_improvement','Home Improvement',      '🛠️', 210),
  ('furniture',      'Furniture & Decor',      '🛋️', 220),
  ('restaurant',     'Restaurants & Dining',   '🍽️', 230),
  ('utility',        'Utilities & Bills',      '💡', 240),
  ('education',      'Education & Books',      '📚', 250),
  ('transport',      'Transportation',         '🚗', 260),
  ('travel',         'Travel & Hospitality',   '✈️', 270),
  ('entertainment',  'Entertainment',          '🎬', 280),
  ('sports',         'Sports & Fitness',       '⚽', 290),
  ('services',       'Services',               '🧾', 300),
  ('stationery',     'Stationery & Office',    '✏️', 310),
  ('toys',           'Toys & Games',           '🧸', 320),
  ('jewelry',        'Jewelry & Accessories',  '💍', 330),
  ('other',          'Other',                  '📦', 999);

-- Subcategories (kept compact — extensible; AI also matches on category_id directly)
WITH c AS (SELECT id, key FROM public.categories)
INSERT INTO public.subcategories (category_id, key, label, keywords, sort_order)
SELECT c.id, sub.key, sub.label, sub.keywords, sub.sort_order
FROM c JOIN (VALUES
  -- grocery
  ('grocery','rice_wheat','Rice & Wheat',     ARRAY['rice','wheat','atta','flour','basmati'], 10),
  ('grocery','daal_pulses','Daal & Pulses',   ARRAY['daal','dal','lentil','pulses','chana','rajma','moong'], 20),
  ('grocery','oil','Cooking Oil',             ARRAY['oil','ghee','sunflower','olive oil','mustard oil'], 30),
  ('grocery','spices','Spices & Masala',      ARRAY['masala','spice','turmeric','chilli','cumin','garam'], 40),
  ('grocery','sugar_salt','Sugar & Salt',     ARRAY['sugar','salt','jaggery','sweetener'], 50),
  ('grocery','sauces','Sauces & Condiments',  ARRAY['ketchup','sauce','mayonnaise','pickle','jam'], 60),
  ('grocery','tea_coffee','Tea & Coffee',     ARRAY['tea','coffee','chai','green tea'], 70),
  ('grocery','noodles_pasta','Noodles & Pasta',ARRAY['noodles','pasta','maggi','spaghetti'], 80),
  ('grocery','breakfast','Breakfast Cereal',  ARRAY['cereal','oats','muesli','cornflakes'], 90),
  -- produce
  ('produce','vegetables','Vegetables',       ARRAY['vegetable','onion','potato','tomato','peas','carrot','spinach','cabbage'], 10),
  ('produce','fruits','Fruits',               ARRAY['fruit','apple','banana','orange','mango','grapes'], 20),
  ('produce','herbs','Herbs & Leafy',         ARRAY['coriander','mint','basil','leafy','greens'], 30),
  -- dairy
  ('dairy','milk','Milk',                     ARRAY['milk','toned','full cream','skim'], 10),
  ('dairy','paneer','Paneer',                 ARRAY['paneer','cottage cheese'], 20),
  ('dairy','curd','Curd & Yogurt',            ARRAY['curd','yogurt','dahi'], 30),
  ('dairy','butter','Butter',                 ARRAY['butter','makhan'], 40),
  ('dairy','ghee','Ghee',                     ARRAY['ghee','clarified butter'], 50),
  ('dairy','cheese','Cheese',                 ARRAY['cheese','mozzarella','cheddar'], 60),
  ('dairy','eggs','Eggs',                     ARRAY['egg','eggs'], 70),
  -- beverages
  ('beverages','soft_drinks','Soft Drinks',   ARRAY['coke','pepsi','soda','soft drink','sprite','fanta'], 10),
  ('beverages','juice','Juices',              ARRAY['juice','tropicana','real','minute maid'], 20),
  ('beverages','water','Water',               ARRAY['water','bisleri','kinley','aquafina'], 30),
  ('beverages','energy','Energy Drinks',      ARRAY['red bull','monster','energy','sting'], 40),
  ('beverages','alcohol','Alcohol',           ARRAY['beer','wine','whisky','rum','vodka'], 50),
  -- snacks/bakery/meat/frozen
  ('snacks','chips','Chips & Crisps',         ARRAY['chips','lays','kurkure','crisps'], 10),
  ('snacks','chocolate','Chocolate',          ARRAY['chocolate','cadbury','dairy milk','kitkat'], 20),
  ('snacks','biscuits','Biscuits & Cookies',  ARRAY['biscuit','cookie','parle','oreo'], 30),
  ('bakery','bread','Bread',                  ARRAY['bread','pav','bun'], 10),
  ('bakery','cake','Cakes & Pastries',        ARRAY['cake','pastry','muffin','donut'], 20),
  ('meat','chicken','Chicken',                ARRAY['chicken','poultry'], 10),
  ('meat','mutton','Mutton & Lamb',           ARRAY['mutton','lamb','goat'], 20),
  ('meat','fish','Fish & Seafood',            ARRAY['fish','prawn','shrimp','seafood'], 30),
  ('frozen','frozen_veg','Frozen Vegetables', ARRAY['frozen peas','frozen corn','frozen veg'], 10),
  ('frozen','ice_cream','Ice Cream',          ARRAY['ice cream','kulfi','gelato'], 20),
  -- hygiene / beauty / household / baby / pets
  ('hygiene','soap','Bathing Soap',           ARRAY['soap','dove','lux','santoor'], 10),
  ('hygiene','shampoo','Shampoo & Conditioner',ARRAY['shampoo','conditioner','head & shoulders'], 20),
  ('hygiene','oral','Oral Care',              ARRAY['toothpaste','toothbrush','colgate','mouthwash'], 30),
  ('hygiene','deodorant','Deodorant',         ARRAY['deodorant','axe','perfume','spray'], 40),
  ('hygiene','sanitary','Sanitary',           ARRAY['sanitary','pad','tampon','whisper','stayfree'], 50),
  ('hygiene','razor','Shaving',               ARRAY['razor','gillette','shaving cream'], 60),
  ('beauty','skincare','Skincare',            ARRAY['cream','moisturizer','lotion','sunscreen'], 10),
  ('beauty','makeup','Makeup',                ARRAY['lipstick','foundation','kajal','mascara'], 20),
  ('beauty','haircare','Hair Care',           ARRAY['hair oil','parachute','hair color'], 30),
  ('household','detergent','Detergent & Laundry',ARRAY['detergent','surf','ariel','tide','laundry'], 10),
  ('household','cleaner','Cleaners',          ARRAY['cleaner','harpic','lizol','vim','phenyl'], 20),
  ('household','utensils','Utensils',         ARRAY['utensil','plate','bowl','cup','pan'], 30),
  ('household','tissues','Tissue & Paper',    ARRAY['tissue','toilet paper','napkin','kitchen towel'], 40),
  ('household','garbage','Garbage Bags',      ARRAY['garbage bag','trash bag','dustbin'], 50),
  ('baby','diapers','Diapers',                ARRAY['diaper','pampers','huggies','nappy'], 10),
  ('baby','formula','Baby Food',              ARRAY['baby food','formula','cerelac','nestum'], 20),
  ('pets','pet_food','Pet Food',              ARRAY['pet food','dog food','cat food','pedigree','whiskas'], 10),
  -- medicine
  ('medicine','painkiller','Pain & Fever',    ARRAY['paracetamol','crocin','dolo','ibuprofen','aspirin','combiflam'], 10),
  ('medicine','antibiotic','Antibiotics',     ARRAY['antibiotic','azithromycin','amoxicillin'], 20),
  ('medicine','cold_cough','Cold & Cough',    ARRAY['cough','syrup','vicks','benadryl','cold'], 30),
  ('medicine','vitamin','Vitamins & Supplements',ARRAY['vitamin','supplement','protein','calcium'], 40),
  ('medicine','first_aid','First Aid',        ARRAY['bandage','antiseptic','dettol','savlon','bandaid'], 50),
  ('medicine','digestive','Digestive',        ARRAY['eno','digene','antacid','gelusil'], 60),
  ('medicine','diabetes','Diabetes Care',     ARRAY['insulin','metformin','glucose'], 70),
  -- fuel / transport / travel
  ('fuel','petrol','Petrol/Gasoline',         ARRAY['petrol','gasoline','gas'], 10),
  ('fuel','diesel','Diesel',                  ARRAY['diesel'], 20),
  ('fuel','cng','CNG/LPG',                    ARRAY['cng','lpg','autogas'], 30),
  ('transport','taxi','Taxi & Ride',          ARRAY['uber','ola','lyft','taxi','cab'], 10),
  ('transport','public','Public Transit',     ARRAY['metro','bus','train','transit'], 20),
  ('transport','parking','Parking & Toll',    ARRAY['parking','toll','fastag'], 30),
  ('travel','flight','Flights',               ARRAY['flight','airline','indigo','airfare'], 10),
  ('travel','hotel','Hotels',                 ARRAY['hotel','airbnb','accommodation'], 20),
  -- clothing / footwear / electronics / mobile / appliances
  ('clothing','tshirt','T-Shirts & Shirts',   ARRAY['tshirt','shirt','top'], 10),
  ('clothing','jeans','Pants & Jeans',        ARRAY['jeans','trouser','pant'], 20),
  ('clothing','innerwear','Innerwear',        ARRAY['innerwear','underwear','vest','bra'], 30),
  ('clothing','ethnic','Ethnic Wear',         ARRAY['kurta','saree','salwar','lehenga'], 40),
  ('footwear','shoes','Shoes',                ARRAY['shoe','sneaker','nike','adidas'], 10),
  ('footwear','sandals','Sandals & Slippers', ARRAY['sandal','slipper','flip flop'], 20),
  ('electronics','laptop','Laptops',          ARRAY['laptop','macbook','notebook'], 10),
  ('electronics','tv','Televisions',          ARRAY['tv','television','smart tv'], 20),
  ('electronics','audio','Audio',             ARRAY['headphone','earphone','speaker','bose'], 30),
  ('electronics','camera','Cameras',          ARRAY['camera','dslr','gopro'], 40),
  ('mobile','smartphone','Smartphones',       ARRAY['phone','smartphone','iphone','samsung galaxy','oneplus'], 10),
  ('mobile','accessory','Accessories',        ARRAY['charger','cable','case','cover','tempered'], 20),
  ('mobile','recharge','Recharge & Plans',    ARRAY['recharge','jio','airtel','vi plan'], 30),
  ('appliances','kitchen','Kitchen Appliances',ARRAY['mixer','grinder','microwave','toaster'], 10),
  ('appliances','large','Large Appliances',   ARRAY['fridge','refrigerator','washing machine','ac','air conditioner'], 20),
  ('appliances','small','Small Appliances',   ARRAY['iron','kettle','blender','fan'], 30),
  -- restaurants / utilities / education / entertainment / sports / services
  ('restaurant','dine_in','Dine-In',          ARRAY['dine','restaurant'], 10),
  ('restaurant','takeaway','Takeaway',        ARRAY['takeaway','take out','parcel'], 20),
  ('restaurant','delivery','Food Delivery',   ARRAY['swiggy','zomato','doordash','uber eats'], 30),
  ('restaurant','cafe','Café & Coffee Shop',  ARRAY['cafe','starbucks','ccd'], 40),
  ('utility','electricity','Electricity Bill',ARRAY['electricity','power bill','bescom','tneb'], 10),
  ('utility','water','Water Bill',            ARRAY['water bill'], 20),
  ('utility','gas','Gas Bill',                ARRAY['gas bill','indane','hp gas'], 30),
  ('utility','internet','Internet & Broadband',ARRAY['broadband','wifi','internet','jio fiber','airtel xstream'], 40),
  ('utility','dth','DTH & Cable',             ARRAY['dth','tata sky','dish tv','cable'], 50),
  ('utility','rent','Rent',                   ARRAY['rent','lease'], 60),
  ('education','books','Books',               ARRAY['book','textbook','novel'], 10),
  ('education','tuition','Tuition & Courses', ARRAY['tuition','course','udemy','coursera','class fee'], 20),
  ('education','stationery_edu','School Supplies',ARRAY['notebook','pen','pencil','school supply'], 30),
  ('entertainment','streaming','Streaming',   ARRAY['netflix','prime','hotstar','spotify','youtube premium'], 10),
  ('entertainment','movies','Movies & Events',ARRAY['movie','bookmyshow','ticket','pvr','imax'], 20),
  ('entertainment','games','Games',           ARRAY['game','steam','playstation','xbox','nintendo'], 30),
  ('sports','gym','Gym & Fitness',            ARRAY['gym','fitness','cult','membership'], 10),
  ('sports','equipment','Sports Equipment',   ARRAY['cricket bat','football','dumbbell','yoga mat'], 20),
  ('services','salon','Salon & Spa',          ARRAY['salon','haircut','spa','massage'], 10),
  ('services','laundry','Laundry & Dry Clean',ARRAY['laundry','dry clean'], 20),
  ('services','repair','Repair & Maintenance',ARRAY['repair','maintenance','plumber','electrician'], 30),
  ('stationery','office','Office Supplies',   ARRAY['stapler','folder','printer paper'], 10),
  ('toys','toy','Toys',                       ARRAY['toy','lego','barbie'], 10),
  ('jewelry','gold','Gold & Silver',          ARRAY['gold','silver','jewelry','jewellery'], 10),
  ('jewelry','watch','Watches',               ARRAY['watch','rolex','titan','fossil'], 20),
  ('home_improvement','paint','Paint & Hardware',ARRAY['paint','asian paints','hardware','tool'], 10),
  ('furniture','furniture_item','Furniture',  ARRAY['sofa','chair','table','bed','mattress'], 10),
  ('furniture','decor','Home Decor',          ARRAY['curtain','lamp','vase','wall art'], 20),
  ('other','misc','Miscellaneous',            ARRAY['misc','other','unknown'], 10)
) AS sub(cat_key, key, label, keywords, sort_order)
ON c.key = sub.cat_key;
