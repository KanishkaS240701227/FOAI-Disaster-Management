"""
Hand-curated seed data for the Chennai relief planner.

IMPORTANT - data honesty notes
------------------------------
* Zone / ward geometry comes from the Datameet / Transparent Chennai open dataset
  (CC BY-SA 2.5 India) and is processed by build_chennai_data.py.
* Suburb areas (Avadi, Pallavaram, Chrompet, Tambaram) are *approximate* extents, built from the
  Chennai Metropolitan Area boundary clipped around each town centre.
* Flood hotspots: coordinates are approximate (+/- ~300 m).  ``source`` says why a place is listed:
    - "NCCR"    : named in the 2019 NCCR "red atlas" of flood-prone localities
    - "GCC"     : named in a Greater Chennai Corporation vulnerable-areas list / press report
    - "Reported": repeatedly reported flooded in the 2015 / 2021 / 2023 events
* Depots are REPRESENTATIVE staging points placed at real, well-known facilities / localities.
  GCC does not publish relief-camp or warehouse addresses as open data, so replace them with your
  own list in the Resources screen.
* Population / density / low-lying weights are modelled estimates (see ZONES) - editable.
"""

# ---------------------------------------------------------------------------------------------
# Zone attributes.  low_lying: 0..1 judgement of flood susceptibility of terrain/drainage.
# density_index: relative population density (normalised later to the target total population).
# ---------------------------------------------------------------------------------------------
GCC_ZONES = {
    1:  dict(name="Thiruvottiyur",      coastal=True,  low_lying=0.75, density=0.75, soil=1.20),
    2:  dict(name="Manali",             coastal=False, low_lying=0.85, density=0.55, soil=1.15),
    3:  dict(name="Madhavaram",         coastal=False, low_lying=0.60, density=0.80, soil=1.05),
    4:  dict(name="Tondiarpet",         coastal=True,  low_lying=0.80, density=1.55, soil=1.20),
    5:  dict(name="Royapuram",          coastal=True,  low_lying=0.70, density=1.45, soil=1.20),
    6:  dict(name="Thiru. Vi. Ka. Nagar", coastal=False, low_lying=0.65, density=1.45, soil=1.10),
    7:  dict(name="Ambattur",           coastal=False, low_lying=0.45, density=0.85, soil=1.00),
    8:  dict(name="Anna Nagar",         coastal=False, low_lying=0.35, density=1.10, soil=1.00),
    9:  dict(name="Teynampet",          coastal=True,  low_lying=0.50, density=1.15, soil=1.15),
    10: dict(name="Kodambakkam",        coastal=False, low_lying=0.45, density=1.35, soil=1.05),
    11: dict(name="Valasaravakkam",     coastal=False, low_lying=0.55, density=1.05, soil=1.00),
    12: dict(name="Alandur",            coastal=False, low_lying=0.55, density=0.95, soil=1.00),
    13: dict(name="Adyar",              coastal=True,  low_lying=0.65, density=0.80, soil=1.15),
    14: dict(name="Perungudi",          coastal=True,  low_lying=0.85, density=0.75, soil=1.20),
    15: dict(name="Sholinganallur",     coastal=True,  low_lying=0.90, density=0.45, soil=1.20),
}

# Suburban corporations / municipalities covered in addition to GCC (approximate extents).
# seed = town centre, radius_km = max reach of the extent from the centre.
SUBURBS = {
    "AVADI":      dict(name="Avadi",             seed=(13.1147, 80.1098), radius_km=5.4, coastal=False,
                       low_lying=0.55, density=0.80, soil=1.00, pop_2026=430_000),
    "PALLAVARAM": dict(name="Pallavaram",        seed=(12.9675, 80.1491), radius_km=3.6, coastal=False,
                       low_lying=0.60, density=1.10, soil=1.00, pop_2026=250_000),
    "CHROMPET":   dict(name="Chrompet",          seed=(12.9516, 80.1462), radius_km=4.2, coastal=False,
                       low_lying=0.65, density=1.10, soil=1.00, pop_2026=170_000),
    "TAMBARAM":   dict(name="Tambaram",          seed=(12.9249, 80.1000), radius_km=8.0, coastal=False,
                       low_lying=0.70, density=0.90, soil=1.00, pop_2026=330_000),
}

GCC_TARGET_POPULATION_2026 = 5_300_000   # 2011 census 4.65 M grown ~1 %/yr (modelled estimate)

# ---------------------------------------------------------------------------------------------
# Flood hotspots.  sev: 1 = nuisance waterlogging, 2 = knee-deep / road closures, 3 = severe /
# houses inundated in past events.  r = influence radius in metres.
# ---------------------------------------------------------------------------------------------
HOTSPOTS = [
    # --- North ------------------------------------------------------------------------------
    ("HS-ENNORE",      "Ennore Creek & Expressway",        13.2140, 80.3180, 2, 900, "Reported"),
    ("HS-THIRUVOTT",   "Thiruvottiyur High Road",           13.1590, 80.3010, 2, 800, "NCCR"),
    ("HS-MANALI",      "Manali",                            13.1660, 80.2650, 3, 1100, "NCCR"),
    ("HS-MATHUR",      "Mathur / Manali New Town",          13.1620, 80.2400, 2, 900, "Reported"),
    ("HS-MADHAVARAM",  "Madhavaram Milk Colony",            13.1490, 80.2330, 2, 800, "Reported"),
    ("HS-PUZHAL",      "Puzhal / Red Hills Road",           13.1650, 80.2020, 2, 900, "Reported"),
    ("HS-KOLATHUR",    "Kolathur & Retteri",                13.1230, 80.2200, 2, 800, "Reported"),
    ("HS-PERAMBUR",    "Perambur",                          13.1143, 80.2330, 3, 800, "NCCR"),
    ("HS-VYASARPADI",  "Vyasarpadi",                        13.1170, 80.2530, 2, 700, "Reported"),
    ("HS-TONDIARPET",  "Tondiarpet",                        13.1260, 80.2910, 3, 800, "Reported"),
    ("HS-WASHERMEN",   "Washermanpet & Royapuram",          13.1100, 80.2870, 2, 800, "Reported"),
    ("HS-BASINBRIDGE", "Basin Bridge",                      13.0950, 80.2690, 2, 600, "Reported"),
    ("HS-KOSAPET",     "Kosapet",                           13.0950, 80.2560, 3, 600, "NCCR"),
    ("HS-PATTALAM",    "Pattalam",                          13.0905, 80.2630, 3, 600, "NCCR"),
    ("HS-PERIAMET",    "Periamet",                          13.0829, 80.2635, 3, 600, "NCCR"),
    ("HS-CHINTADRIPET","Chintadripet (Cooum)",              13.0775, 80.2660, 3, 600, "NCCR"),
    # --- West / North-west ------------------------------------------------------------------
    ("HS-KARUKKU",     "Ambattur - Karukku Main Road",      13.1140, 80.1580, 2, 800, "GCC"),
    ("HS-KORATTUR",    "Korattur Subway",                   13.1105, 80.1850, 2, 600, "GCC"),
    ("HS-VILLIVAKKAM", "Villivakkam / Siva Ilango Nagar",   13.1080, 80.2050, 2, 700, "Reported"),
    ("HS-MOGAPPAIR",   "Mogappair West",                    13.0860, 80.1720, 2, 800, "Reported"),
    ("HS-KOYAMBEDU",   "Koyambedu Market",                  13.0695, 80.1940, 3, 800, "GCC"),
    ("HS-VIRUGAM",     "Virugambakkam / Arumbakkam",        13.0600, 80.2050, 2, 700, "Reported"),
    ("HS-MADURAVOYAL", "Maduravoyal",                       13.0640, 80.1650, 2, 800, "Reported"),
    ("HS-PORUR",       "Porur Lake & Ramapuram",            13.0380, 80.1580, 3, 900, "Reported"),
    ("HS-MUGALIVAKKAM","Mugalivakkam / Manapakkam",         13.0230, 80.1700, 3, 900, "Reported"),
    ("HS-THIRUMULLAI", "Thirumullaivoyal",                  13.1300, 80.1330, 2, 900, "Reported"),
    ("HS-PATTABIRAM",  "Pattabiram & Avadi Lake",           13.1200, 80.0630, 2, 900, "Reported"),
    ("HS-AVADI",       "Avadi - Muthapudupet",              13.1180, 80.1100, 1, 700, "Reported"),
    # --- Central ----------------------------------------------------------------------------
    ("HS-MAMBALAM",    "West Mambalam Canal",               13.0390, 80.2210, 2, 600, "Reported"),
    ("HS-VADAPALANI",  "Vadapalani - Kodambakkam",          13.0510, 80.2150, 1, 600, "Reported"),
    ("HS-SAIDAPET",    "Saidapet - Adyar Bridge",           13.0213, 80.2230, 2, 600, "Reported"),
    ("HS-KOTTURPURAM", "Kotturpuram (Adyar bank)",          13.0200, 80.2400, 2, 600, "Reported"),
    ("HS-ADYAR",       "Adyar Estuary",                     13.0090, 80.2540, 2, 700, "Reported"),
    ("HS-MYLAPORE",    "Mylapore - Mandaveli",              13.0290, 80.2640, 2, 600, "Reported"),
    ("HS-TRIPLICANE",  "Triplicane / Chepauk (Cooum mouth)",13.0640, 80.2780, 1, 600, "Reported"),
    ("HS-GUINDY",      "Guindy - Race Course",              13.0070, 80.2200, 1, 600, "Reported"),
    ("HS-ALANDUR",     "Alandur Subway",                    13.0030, 80.2010, 2, 600, "Reported"),
    # --- South ------------------------------------------------------------------------------
    ("HS-NANGANALLUR","Nanganallur / Adambakkam",           12.9850, 80.1900, 2, 800, "Reported"),
    ("HS-MADIPAKKAM", "Madipakkam / Kovilambakkam",         12.9570, 80.1950, 3, 900, "Reported"),
    ("HS-VELACHERY",  "Velachery - Vijayanagar",            12.9830, 80.2200, 3, 900, "Reported"),
    ("HS-TARAMANI",   "Taramani - Dhandeeswaram",           12.9890, 80.2380, 2, 700, "Reported"),
    ("HS-PERUNGUDI",  "Perungudi / Kandanchavadi",          12.9650, 80.2450, 2, 800, "Reported"),
    ("HS-PALLIKARANAI","Pallikaranai Marsh",                12.9370, 80.2150, 3, 1200, "Reported"),
    ("HS-MEDAVAKKAM", "Medavakkam",                         12.9200, 80.1930, 3, 900, "Reported"),
    ("HS-THORAIPAKKAM","Thoraipakkam (OMR)",                12.9380, 80.2330, 2, 800, "Reported"),
    ("HS-KARAPAKKAM", "Karapakkam / Sholinganallur",        12.9015, 80.2280, 2, 900, "Reported"),
    ("HS-PERUMBAKKAM","Perumbakkam / Semmenchery",          12.9010, 80.2140, 3, 900, "Reported"),
    ("HS-THIRUVANMIYUR","Thiruvanmiyur - Buckingham Canal", 12.9830, 80.2590, 1, 600, "Reported"),
    ("HS-NEELANKARAI","Neelankarai & ECR",                  12.9490, 80.2590, 1, 700, "Reported"),
    # --- Suburbs ----------------------------------------------------------------------------
    ("HS-PALLAVARAM", "Pallavaram - GST Road",              12.9680, 80.1500, 2, 800, "GCC"),
    ("HS-PAMMAL",     "Pammal / Anakaputhur (Adyar bank)",  12.9600, 80.1330, 2, 800, "Reported"),
    ("HS-CHROMPET",   "Chrompet - GST Road",                12.9520, 80.1440, 2, 700, "GCC"),
    ("HS-CHITLAPAKKAM","Chitlapakkam Lake",                 12.9330, 80.1410, 3, 800, "GCC"),
    ("HS-SELAIYUR",   "Selaiyur / Sembakkam Lake",          12.9120, 80.1400, 2, 800, "Reported"),
    ("HS-TAMBARAM",   "East Tambaram",                      12.9250, 80.1180, 1, 700, "Reported"),
    ("HS-PERUNGALATHUR","Perungalathur",                    12.9050, 80.0970, 2, 800, "Reported"),
    ("HS-VARADHA",    "Varadharajapuram (Adyar bank)",      12.9075, 80.0800, 3, 800, "Reported"),
    ("HS-MUDICHUR",   "Mudichur",                           12.9030, 80.0610, 3, 900, "Reported"),
]

# ---------------------------------------------------------------------------------------------
# Representative relief depots.  scale: S / M / L (stock multiplier 1 / 2 / 4).
# ---------------------------------------------------------------------------------------------
DEPOTS = [
    ("D-RIPON",      "Ripon Buildings - Command Depot",        13.0827, 80.2707, "L"),
    ("D-KOYAMBEDU",  "Koyambedu Market Logistics Hub",         13.0712, 80.1948, "L"),
    ("D-ROYAPURAM",  "Royapuram Port-side Warehouses",         13.1040, 80.2910, "L"),
    ("D-AMBATTUR",   "Ambattur Industrial Estate Depot",       13.1000, 80.1600, "L"),
    ("D-GUINDY",     "Guindy Industrial Estate Depot",         13.0095, 80.2120, "L"),
    ("D-MEENAMBAKKAM","Meenambakkam Airport Cargo Staging",    12.9900, 80.1690, "L"),
    ("D-MANALI",     "Manali Industrial Relief Depot",         13.1700, 80.2580, "M"),
    ("D-MADHAVARAM", "Madhavaram Milk Colony Depot",           13.1480, 80.2310, "M"),
    ("D-TONDIARPET", "Tondiarpet Grain Godown",                13.1250, 80.2870, "M"),
    ("D-NEHRU",      "Nehru Indoor Stadium Relief Hub",        13.0805, 80.2610, "M"),
    ("D-ANNAUNIV",   "Anna University Campus Hub",             13.0108, 80.2354, "M"),
    ("D-ALANDUR",    "Alandur - St Thomas Mount Depot",        13.0035, 80.2005, "M"),
    ("D-PERUNGUDI",  "Perungudi OMR Relief Depot",             12.9650, 80.2460, "M"),
    ("D-SHOLINGA",   "Sholinganallur OMR Relief Depot",        12.9010, 80.2280, "M"),
    ("D-AVADI",      "Avadi Heavy Vehicles Staging Area",      13.1050, 80.1050, "M"),
    ("D-PALLAVARAM", "Pallavaram Cantonment Depot",            12.9690, 80.1520, "M"),
    ("D-TAMBARAM",   "Tambaram Air Force Station Staging",     12.9066, 80.1218, "M"),
    ("D-ANNANAGAR",  "Anna Nagar Zonal Depot",                 13.0850, 80.2100, "S"),
    ("D-TNAGAR",     "T. Nagar Zonal Depot",                   13.0420, 80.2330, "S"),
    ("D-ADYAR",      "Adyar Zonal Relief Depot",               13.0070, 80.2570, "S"),
    ("D-TARAMANI",   "Taramani Campus Hub",                    12.9870, 80.2430, "S"),
    ("D-CHROMPET",   "Chrompet Bus Depot Relief Point",        12.9520, 80.1400, "S"),
    ("D-THIRUVOTT",  "Thiruvottiyur Zonal Depot",              13.1590, 80.3000, "S"),
]

SCALE_MULT = {"S": 1, "M": 2, "L": 4}
# Base stock per "S" depot (units = packaged relief items)
BASE_STOCK = dict(food=6000, water=1500, medicine=420, blankets=3000, emergency_kits=1200)

# Truck types: (label, capacity_units, fuel_cap_l, speed_kmh, l_per_km)
TRUCK_TYPES = {
    "mini":   ("Mini truck (1.5 t)",  1200,  60, 40, 0.12),
    "light":  ("Light truck (4 t)",   2500, 100, 36, 0.20),
    "medium": ("Medium truck (9 t)",  6000, 200, 32, 0.30),
}
FLEET_BY_SCALE = {"S": ["light"], "M": ["medium", "light"], "L": ["medium", "light", "mini"]}

# Relief needs per person (units / person / day)
PER_PERSON = dict(food=1.0, water=0.25, medicine=0.07, blankets=0.5, emergency_kits=0.2)
