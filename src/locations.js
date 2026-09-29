// GENERATED FILE - do not edit.
// Source: locations/geojson/*.geojson
// Regenerate: npm run build:locations  (tools/build-locations.mjs)

// Every campus element, as its own toggleable map overlay. map.js turns each
// layer into a row of the overlays menu and each place into a marker whose
// popup links back to the cards that ask about it.

window.HNSLocations = {
    layers: [
        {
            "key": "campus",
            "label": "Campus border",
            "color": "#eab308",
            "kind": "polygon",
            "cardIds": [
                "closer_outer_ring"
            ],
            "name": "U. Laval campus loop",
            "detail": [
                ["About", "Closed loop from campus-side lanes of Ch. Sainte-Foy, Av. Myrand, Bd Rene-Levesque O., Bd Laurier, Autoroute Robert-Bourassa. Source: OpenStreetMap."]
            ],
            "ring": [
                [-71.2808082, 46.7788166],
                [-71.2838532, 46.7813018],
                [-71.2841863, 46.7816893],
                [-71.2843027, 46.7818247],
                [-71.2847281, 46.7821672],
                [-71.2851535, 46.7825098],
                [-71.2852593, 46.782595],
                [-71.2857185, 46.7829164],
                [-71.2858391, 46.7830008],
                [-71.2853998, 46.7832635],
                [-71.2849052, 46.7835593],
                [-71.2844107, 46.7838551],
                [-71.2839161, 46.7841509],
                [-71.2836135, 46.7843319],
                [-71.2831308, 46.7846367],
                [-71.2827713, 46.7848638],
                [-71.2822737, 46.7851573],
                [-71.2822397, 46.7851774],
                [-71.2817036, 46.785437],
                [-71.2811675, 46.7856967],
                [-71.2809932, 46.7857811],
                [-71.2791902, 46.7864878],
                [-71.272133, 46.7883991],
                [-71.2705267, 46.7890142],
                [-71.2684162, 46.7874413],
                [-71.2675861, 46.7872106],
                [-71.2674, 46.7870823],
                [-71.2629233, 46.7836081],
                [-71.2627947, 46.7835235],
                [-71.2638773, 46.7829951],
                [-71.2642476, 46.7825718],
                [-71.2649544, 46.7800255],
                [-71.2650157, 46.779846],
                [-71.2651512, 46.7795975],
                [-71.2653236, 46.7793733],
                [-71.2654875, 46.7791994],
                [-71.2659391, 46.778873],
                [-71.2659781, 46.7788447],
                [-71.2663081, 46.7786433],
                [-71.275402, 46.774],
                [-71.2808082, 46.7788166]
            ]
        },
        {
            "key": "landmarks",
            "label": "Landmarks",
            "color": "#a855f7",
            "kind": "points",
            "labelled": true,
            "cardIds": [
                "closer_church",
                "closer_twin_towers",
                "closer_ulaval_sign",
                "closer_greenhouses",
                "closer_football_stadium",
                "closer_pub_u"
            ],
            "places": [
                {
                    "id": "church",
                    "label": "Church",
                    "lat": 46.7828721,
                    "lng": -71.2705679,
                    "detail": [
                        ["About", "Campus reference landmark for the \u201care you closer to __ than me?\u201d question."]
                    ],
                    "cardIds": [
                        "closer_church"
                    ]
                },
                {
                    "id": "twin_towers",
                    "label": "Twin Towers",
                    "lat": 46.7813496,
                    "lng": -71.2729934,
                    "detail": [
                        ["About", "Campus reference landmark for the \u201care you closer to __ than me?\u201d question."]
                    ],
                    "cardIds": [
                        "closer_twin_towers"
                    ]
                },
                {
                    "id": "ulaval_sign",
                    "label": "ULaval Sign",
                    "lat": 46.7803101,
                    "lng": -71.2748154,
                    "detail": [
                        ["About", "Campus reference landmark for the \u201care you closer to __ than me?\u201d question."]
                    ],
                    "cardIds": [
                        "closer_ulaval_sign"
                    ]
                },
                {
                    "id": "greenhouses",
                    "label": "Greenhouses",
                    "lat": 46.7799898,
                    "lng": -71.2798912,
                    "detail": [
                        ["About", "Campus reference landmark for the \u201care you closer to __ than me?\u201d question."]
                    ],
                    "cardIds": [
                        "closer_greenhouses"
                    ]
                },
                {
                    "id": "football_stadium",
                    "label": "Football Stadium",
                    "lat": 46.7838237,
                    "lng": -71.2796249,
                    "detail": [
                        ["About", "Campus reference landmark for the \u201care you closer to __ than me?\u201d question."]
                    ],
                    "cardIds": [
                        "closer_football_stadium"
                    ]
                },
                {
                    "id": "pub_u",
                    "label": "Pub U",
                    "lat": 46.7786919,
                    "lng": -71.2691964,
                    "detail": [
                        ["About", "Campus reference landmark for the \u201care you closer to __ than me?\u201d question."]
                    ],
                    "cardIds": [
                        "closer_pub_u"
                    ]
                }
            ]
        },
        {
            "key": "building",
            "label": "Pavilions",
            "color": "#f97316",
            "kind": "points",
            "cardIds": [
                "nearest_building"
            ],
            "places": [
                {
                    "id": "pav_abp",
                    "label": "Pavillon Abitibi-Price (ABP)",
                    "lat": 46.7803736,
                    "lng": -71.2796006,
                    "detail": [
                        ["Code", "ABP"],
                        ["OpenStreetMap", "relation/3728533"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_plt",
                    "label": "Pavillon Adrien-Pouliot (PLT)",
                    "lat": 46.7786973,
                    "lng": -71.2750088,
                    "detail": [
                        ["Code", "PLT"],
                        ["OpenStreetMap", "relation/35018"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_lct",
                    "label": "Pavillon Agathe-Lacerte (LCT)",
                    "lat": 46.776235,
                    "lng": -71.2746072,
                    "detail": [
                        ["Code", "LCT"],
                        ["OpenStreetMap", "relation/35020"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_vch",
                    "label": "Pavillon Alexandre-Vachon (VCH)",
                    "lat": 46.7803276,
                    "lng": -71.2768114,
                    "detail": [
                        ["Code", "VCH"],
                        ["OpenStreetMap", "relation/35017"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_adj",
                    "label": "Pavillon Alphonse-Desjardins (ADJ)",
                    "lat": 46.7789502,
                    "lng": -71.2697743,
                    "detail": [
                        ["Code", "ADJ"],
                        ["OpenStreetMap", "way/162322156"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_prn",
                    "label": "Pavillon Alphonse-Marie-Parent (PRN)",
                    "lat": 46.7803809,
                    "lng": -71.266878,
                    "detail": [
                        ["Code", "PRN"],
                        ["OpenStreetMap", "relation/3741236"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_dkn",
                    "label": "Pavillon Charles-De Koninck (DKN)",
                    "lat": 46.7812277,
                    "lng": -71.2749078,
                    "detail": [
                        ["Code", "DKN"],
                        ["OpenStreetMap", "relation/35015"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_chm",
                    "label": "Pavillon Charles-Eug\u00e8ne-Marchand (CHM)",
                    "lat": 46.7795642,
                    "lng": -71.2784541,
                    "detail": [
                        ["Code", "CHM"],
                        ["OpenStreetMap", "way/27438340"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_cop",
                    "label": "Pavillon d'Optique-photonique (COP)",
                    "lat": 46.7813455,
                    "lng": -71.2778306,
                    "detail": [
                        ["Code", "COP"],
                        ["OpenStreetMap", "relation/7145131"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_peps",
                    "label": "Pavillon de l'\u00e9ducation physique et des sports (PEPS)",
                    "lat": 46.7846704,
                    "lng": -71.2776533,
                    "detail": [
                        ["Code", "PEPS"],
                        ["OpenStreetMap", "way/27437938"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_mde",
                    "label": "Pavillon de la M\u00e9decine dentaire (MDE)",
                    "lat": 46.7807684,
                    "lng": -71.2819199,
                    "detail": [
                        ["Code", "MDE"],
                        ["OpenStreetMap", "way/128588311"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_lem",
                    "label": "Pavillon Ernest-Lemieux (LEM)",
                    "lat": 46.7784331,
                    "lng": -71.2686135,
                    "detail": [
                        ["Code", "LEM"],
                        ["OpenStreetMap", "way/27438478"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_fas",
                    "label": "Pavillon F\u00e9lix-Antoine-Savard (FAS)",
                    "lat": 46.7810216,
                    "lng": -71.2726575,
                    "detail": [
                        ["Code", "FAS"],
                        ["OpenStreetMap", "way/308294329"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_vnd",
                    "label": "Pavillon Ferdinand-Vandry (VND)",
                    "lat": 46.7784847,
                    "lng": -71.2780649,
                    "detail": [
                        ["Code", "VND"],
                        ["OpenStreetMap", "relation/3728043"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_ghk",
                    "label": "Pavillon Gene-H. Kruger (GHK)",
                    "lat": 46.7797263,
                    "lng": -71.2806975,
                    "detail": [
                        ["Code", "GHK"],
                        ["OpenStreetMap", "relation/3728532"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_pbm",
                    "label": "Pavillon H.-Biermans-L.-Moraud (PBM)",
                    "lat": 46.7797457,
                    "lng": -71.2680828,
                    "detail": [
                        ["Code", "PBM"],
                        ["OpenStreetMap", "way/127680668"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_des",
                    "label": "Pavillon J.-A.-De S\u00e8ve (DES)",
                    "lat": 46.7823042,
                    "lng": -71.2740669,
                    "detail": [
                        ["Code", "DES"],
                        ["OpenStreetMap", "way/27438088"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_bnf",
                    "label": "Pavillon Jean-Charles-Bonenfant (BNF)",
                    "lat": 46.7802597,
                    "lng": -71.2737886,
                    "detail": [
                        ["Code", "BNF"],
                        ["OpenStreetMap", "way/27438173"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_jla",
                    "label": "Pavillon Jeanne-Lapointe (JLA)",
                    "lat": 46.7816289,
                    "lng": -71.2733735,
                    "detail": [
                        ["Code", "JLA"],
                        ["OpenStreetMap", "way/308294330"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_lau",
                    "label": "Pavillon La Laurentienne (LAU)",
                    "lat": 46.7826838,
                    "lng": -71.2735561,
                    "detail": [
                        ["Code", "LAU"],
                        ["OpenStreetMap", "way/27438123"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_csl",
                    "label": "Pavillon Louis-Jacques-Casault (CSL)",
                    "lat": 46.7828145,
                    "lng": -71.2703801,
                    "detail": [
                        ["Code", "CSL"],
                        ["OpenStreetMap", "way/128523972"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_pol",
                    "label": "Pavillon Maurice-Pollack (POL)",
                    "lat": 46.779163,
                    "lng": -71.2692303,
                    "detail": [
                        ["Code", "POL"],
                        ["OpenStreetMap", "way/195278975"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_pap",
                    "label": "Pavillon Palasis-Prince (PAP)",
                    "lat": 46.7831874,
                    "lng": -71.2744756,
                    "detail": [
                        ["Code", "PAP"],
                        ["OpenStreetMap", "way/27438075"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_cmt",
                    "label": "Pavillon Paul-Comtois (CMT)",
                    "lat": 46.7764969,
                    "lng": -71.2768302,
                    "detail": [
                        ["Code", "CMT"],
                        ["OpenStreetMap", "relation/35019"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                },
                {
                    "id": "pav_ssi",
                    "label": "Stade TELUS (SSI)",
                    "lat": 46.7831139,
                    "lng": -71.280809,
                    "detail": [
                        ["Code", "SSI"],
                        ["OpenStreetMap", "way/148704391"]
                    ],
                    "cardIds": [
                        "nearest_building"
                    ]
                }
            ]
        },
        {
            "key": "cafe",
            "label": "Caf\u00e9s",
            "color": "#ec4899",
            "kind": "points",
            "cardIds": [
                "nearest_cafe"
            ],
            "places": [
                {
                    "id": "cafe_peps",
                    "label": "Caf\u00e9 \u00c9quilibre (PEPS)",
                    "lat": 46.7856008,
                    "lng": -71.2777692,
                    "detail": [
                        ["Pavillon", "\u00c9duc. physique et sports"],
                        ["Room", "2826"],
                        ["Run by", "commercial (Barista)"],
                        ["Kind", "corporate"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                },
                {
                    "id": "cafe_adj",
                    "label": "Caf\u00e9 Fou AELI\u00c9S (ADJ)",
                    "lat": 46.7788178,
                    "lng": -71.2686253,
                    "detail": [
                        ["Pavillon", "Alphonse-Desjardins"],
                        ["Room", "1550"],
                        ["Run by", "A\u00c9LI\u00c9S (caf\u00e9-bar)"],
                        ["Kind", "student-run"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                },
                {
                    "id": "cafe_mde",
                    "label": "Caf\u00e9 L'Interprox (MDE)",
                    "lat": 46.780768,
                    "lng": -71.28192,
                    "detail": [
                        ["Pavillon", "M\u00e9decine dentaire"],
                        ["Run by", "Facult\u00e9 m\u00e9d. dentaire"],
                        ["Kind", "student-run"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                },
                {
                    "id": "cafe_csl",
                    "label": "Caf\u00e9 Labyrinthe (CSL)",
                    "lat": 46.7829285,
                    "lng": -71.2701229,
                    "detail": [
                        ["Pavillon", "Louis-Jacques-Casault"],
                        ["Room", "1735-A"],
                        ["Run by", "\u00e9coresponsable"],
                        ["Kind", "student-run"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                },
                {
                    "id": "cafe_dkn",
                    "label": "Chez Pol (DKN)",
                    "lat": 46.7819341,
                    "lng": -71.2743985,
                    "detail": [
                        ["Pavillon", "Charles-De Koninck"],
                        ["Room", "0138"],
                        ["Run by", "assoc. sc. politique (caf\u00e9 0,50 $)"],
                        ["Kind", "student-run"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                },
                {
                    "id": "cafe_pap",
                    "label": "Espace Cosmos (Palasis-Prince) (PAP)",
                    "lat": 46.783187,
                    "lng": -71.274476,
                    "detail": [
                        ["Pavillon", "Palasis-Prince"],
                        ["Run by", "Cosmos"],
                        ["Kind", "corporate"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                },
                {
                    "id": "cafe_vnd",
                    "label": "Exocytose (VND)",
                    "lat": 46.778631,
                    "lng": -71.2773067,
                    "detail": [
                        ["Pavillon", "Ferdinand-Vandry"],
                        ["Room", "1750"],
                        ["Run by", "100% autog\u00e9r\u00e9"],
                        ["Kind", "student-run"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                },
                {
                    "id": "cafe_fas",
                    "label": "FAS Caf\u00e9 (FAS)",
                    "lat": 46.781001,
                    "lng": -71.272668,
                    "detail": [
                        ["Pavillon", "F\u00e9lix-Antoine-Savard"],
                        ["Room", "118"],
                        ["Run by", "assoc. \u00e9tudiante"],
                        ["Kind", "student-run"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                },
                {
                    "id": "cafe_plt",
                    "label": "Le Vecteur (PLT)",
                    "lat": 46.778697,
                    "lng": -71.275009,
                    "detail": [
                        ["Pavillon", "Adrien-Pouliot"],
                        ["Run by", "commercial (Barista)"],
                        ["Kind", "corporate"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                },
                {
                    "id": "cafe_abp",
                    "label": "P'tit CAAF (ABP)",
                    "lat": 46.780515,
                    "lng": -71.279541,
                    "detail": [
                        ["Pavillon", "Abitibi-Price"],
                        ["Run by", "assoc. foresterie/g\u00e9o"],
                        ["Kind", "student-run"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                },
                {
                    "id": "cafe_vch",
                    "label": "Snak (VCH)",
                    "lat": 46.780563,
                    "lng": -71.277016,
                    "detail": [
                        ["Pavillon", "Alexandre-Vachon"],
                        ["Run by", "commercial (Barista)"],
                        ["Kind", "corporate"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                },
                {
                    "id": "cafe_cmt",
                    "label": "Toast Caf\u00e9 (CMT)",
                    "lat": 46.776609,
                    "lng": -71.276785,
                    "detail": [
                        ["Pavillon", "Paul-Comtois"],
                        ["Room", "0110"],
                        ["Run by", "assoc. \u00e9tudiante"],
                        ["Kind", "student-run"]
                    ],
                    "cardIds": [
                        "nearest_cafe"
                    ]
                }
            ]
        },
        {
            "key": "bus_stop",
            "label": "Bus stops",
            "color": "#3b82f6",
            "kind": "points",
            "cardIds": [
                "nearest_bus_stop"
            ],
            "places": [
                {
                    "id": "stop_1501",
                    "label": "Biblioth\u00e8ques (1501)",
                    "lat": 46.7818458,
                    "lng": -71.2714842,
                    "detail": [
                        ["RTC stop", "1501"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1542",
                    "label": "Biblioth\u00e8ques (1542)",
                    "lat": 46.7820926,
                    "lng": -71.2720363,
                    "detail": [
                        ["RTC stop", "1542"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1994",
                    "label": "C\u00e9gep-de-Ste-Foy (1994)",
                    "lat": 46.7838372,
                    "lng": -71.284346,
                    "detail": [
                        ["RTC stop", "1994"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_7000",
                    "label": "de la Foresterie (7000)",
                    "lat": 46.7801773,
                    "lng": -71.2785646,
                    "detail": [
                        ["RTC stop", "7000"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_7009",
                    "label": "de la Foresterie (7009)",
                    "lat": 46.7800515,
                    "lng": -71.2791681,
                    "detail": [
                        ["RTC stop", "7009"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1502",
                    "label": "de la Terasse (1502)",
                    "lat": 46.7839867,
                    "lng": -71.2739655,
                    "detail": [
                        ["RTC stop", "1502"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1553",
                    "label": "de la Terrasse (1553)",
                    "lat": 46.7832243,
                    "lng": -71.2733468,
                    "detail": [
                        ["RTC stop", "1553"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_3172",
                    "label": "Hochelaga (3172)",
                    "lat": 46.775246,
                    "lng": -71.2767255,
                    "detail": [
                        ["RTC stop", "3172"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1556",
                    "label": "M\u00e9decine (1556)",
                    "lat": 46.7797999,
                    "lng": -71.2777791,
                    "detail": [
                        ["RTC stop", "1556"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1557",
                    "label": "M\u00e9decine (1557)",
                    "lat": 46.7785969,
                    "lng": -71.2762685,
                    "detail": [
                        ["RTC stop", "1557"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1558",
                    "label": "M\u00e9decine (1558)",
                    "lat": 46.7766617,
                    "lng": -71.2739583,
                    "detail": [
                        ["RTC stop", "1558"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1473",
                    "label": "Myrand (1473)",
                    "lat": 46.7887615,
                    "lng": -71.2709209,
                    "detail": [
                        ["RTC stop", "1473"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_2709",
                    "label": "N\u00e9r\u00e9e-Tremblay (2709)",
                    "lat": 46.785894,
                    "lng": -71.280487,
                    "detail": [
                        ["RTC stop", "2709"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1783",
                    "label": "P.-De Lotbini\u00e8re (1783)",
                    "lat": 46.7781283,
                    "lng": -71.2675712,
                    "detail": [
                        ["RTC stop", "1783"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_7002",
                    "label": "Quatre Bourgeois (7002)",
                    "lat": 46.7839401,
                    "lng": -71.2839057,
                    "detail": [
                        ["RTC stop", "7002"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_7006",
                    "label": "Quatre-Bourgeois (7006)",
                    "lat": 46.7836163,
                    "lng": -71.2836456,
                    "detail": [
                        ["RTC stop", "7006"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1995",
                    "label": "Station du PEPS (1995)",
                    "lat": 46.7858115,
                    "lng": -71.2765617,
                    "detail": [
                        ["RTC stop", "1995"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_7001",
                    "label": "Station Stade Telus (7001)",
                    "lat": 46.7820811,
                    "lng": -71.2812146,
                    "detail": [
                        ["RTC stop", "7001"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1504",
                    "label": "Ste-Foy (1504)",
                    "lat": 46.7863328,
                    "lng": -71.2766913,
                    "detail": [
                        ["RTC stop", "1504"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1472",
                    "label": "Universit\u00e9 Laval (1472)",
                    "lat": 46.7870548,
                    "lng": -71.2765809,
                    "detail": [
                        ["RTC stop", "1472"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1515",
                    "label": "Universit\u00e9 Laval (1515)",
                    "lat": 46.7793193,
                    "lng": -71.2708268,
                    "detail": [
                        ["RTC stop", "1515"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1561",
                    "label": "Universit\u00e9 Laval (1561)",
                    "lat": 46.7792834,
                    "lng": -71.270306,
                    "detail": [
                        ["RTC stop", "1561"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                },
                {
                    "id": "stop_1830",
                    "label": "Universit\u00e9 Laval (1830)",
                    "lat": 46.7766274,
                    "lng": -71.2706534,
                    "detail": [
                        ["RTC stop", "1830"],
                        ["Network", "RTC"]
                    ],
                    "cardIds": [
                        "nearest_bus_stop"
                    ]
                }
            ]
        },
        {
            "key": "velo",
            "label": "\u00e0V\u00e9lo stations",
            "color": "#22c55e",
            "kind": "points",
            "cardIds": [
                "nearest_velo"
            ],
            "places": [
                {
                    "id": "velo_59",
                    "label": "Myrand / Li\u00e9nard",
                    "lat": 46.7850859,
                    "lng": -71.2648726,
                    "detail": [
                        ["Capacity", "20 bikes"],
                        ["Station", "59"]
                    ],
                    "cardIds": [
                        "nearest_velo"
                    ]
                },
                {
                    "id": "velo_90",
                    "label": "ULaval - Abitibi-Price",
                    "lat": 46.7805538,
                    "lng": -71.2787865,
                    "detail": [
                        ["Capacity", "20 bikes"],
                        ["Station", "90"]
                    ],
                    "cardIds": [
                        "nearest_velo"
                    ]
                },
                {
                    "id": "velo_63",
                    "label": "ULaval - Adrien-Pouliot",
                    "lat": 46.77901,
                    "lng": -71.2765509,
                    "detail": [
                        ["Capacity", "32 bikes"],
                        ["Station", "63"]
                    ],
                    "cardIds": [
                        "nearest_velo"
                    ]
                },
                {
                    "id": "velo_61",
                    "label": "ULaval - Alphonse-Desjardins",
                    "lat": 46.7787822,
                    "lng": -71.2704399,
                    "detail": [
                        ["Capacity", "24 bikes"],
                        ["Station", "61"]
                    ],
                    "cardIds": [
                        "nearest_velo"
                    ]
                },
                {
                    "id": "velo_60",
                    "label": "ULaval - Charles-De Koninck",
                    "lat": 46.7802282,
                    "lng": -71.2725407,
                    "detail": [
                        ["Capacity", "24 bikes"],
                        ["Station", "60"]
                    ],
                    "cardIds": [
                        "nearest_velo"
                    ]
                },
                {
                    "id": "velo_62",
                    "label": "ULaval - PEPS",
                    "lat": 46.783319,
                    "lng": -71.2760601,
                    "detail": [
                        ["Capacity", "32 bikes"],
                        ["Station", "62"]
                    ],
                    "cardIds": [
                        "nearest_velo"
                    ]
                }
            ]
        }
    ],
};
