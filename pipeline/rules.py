"""Editable rules: what counts as Barça, which section a video goes in, and the stories.

Everything that is a judgment call lives here, so changing a rule never means
touching the pipeline code. To add a story: append one entry to STORIES.
"""
import re

# ---- Barça relevance -------------------------------------------------------
# A video is kept only if its title (or, failing that, its description's first
# line) names the club, its people, or its teams.
BARCA_TERMS = re.compile(
    r"\b(bar[cç]a|barcelona|fcb|fc\s?b|cul[eé]s?|blaugrana|blau\s?i\s?grana|camp\s?nou|spotify camp|"
    r"la masia|juvenil|bar[cç]a atl[eè]tic|flick|laporta|deco|yamal|lamine|raphinha|rapha|pedri|gavi|"
    r"de jong|frenkie|ferm[ií]n|olmo|lewandowski|kound[eé]|bald[eé]|ara[uú]jo|cubars[ií]|joan garc[ií]a|"
    r"christensen|eric garc[ií]a|casad[oó]|fari[ñn]as|guillem v[ií]ctor|cancelo|livakovic|adeyemi|"
    r"bardghji|szcz[eę]sny|rodri|cl[aá]sico|barcelonismo)\b",
    re.I,
)

# Titles that mention a Barça name but are about something else.
NOT_BARCA = re.compile(
    r"(why does real madrid always|real madrid are scary|valverde 93|athens 2-3 real madrid|"
    r"racing 0-3 real madrid|mbapp[eé] and tebas|mourinho .we are in a rebuilding)",
    re.I,
)

# Channels whose every upload is about Barça (club channel, La Masia streams).
ALWAYS_BARCA = {"FC Barcelona", "Barca Nation"}

# ---- Sections ----------------------------------------------------------------
HIGHLIGHT = re.compile(
    r"(highlights?|resumen|goles|all goals|every .* goal|goals \||full match|\b\d+\s?vs\s?\d+\b|"
    r"liga f \||barca (u\d+|juvenil|cadet|infantil)|bar[cç]a atl[eè]tic vs|live: barca|live match)",
    re.I,
)
PODCAST = re.compile(r"(podcast|\bE\d{3}:|\| TBP)", re.I)
NEWS = re.compile(
    r"(news|noticias|breaking|última hora|press conference|rueda de prensa|conférence|press \||flick press|"
    r"renewal|renov|extends|extend his|prolongation|transfer|fichaje|mercato|injur|lesi[oó]n|confirmed|"
    r"official|oficial|target|signs?\b|sign forn|cerrado|acuerdo)",
    re.I,
)

# Channel defaults when the title alone doesn't decide (keyed by channel name).
CHANNEL_SECTION = {
    "Barca Nation": "highlights",
    "Barca News": "news",
    "EL CULÉ": "news",
    "Barcelona Live": "news",
    "We Coach Barcelona": "news",
    "The Barcelona Podcast": "podcasts",
    "Team Barça Podcast": "podcasts",
    "Barça Siempre Positivo": "podcasts",
}

# ---- Stories -------------------------------------------------------------------
# A story counts as "covered by several channels" when videos from at least
# STORY_MIN_CHANNELS different channels match it. First matching rule wins.
STORY_MIN_CHANNELS = 3

# Topic stories are hand-written and go stale; edit or add them as news moves on.
# Match stories are automatic: any opponent below, in a title that also reads like
# match coverage, groups into "Barça vs <opponent>". Labels never carry scores, so
# spoiler-free mode stays clean.
TOPICS_FIRST = [
    {"id": "raphinha-renewal", "label": "Raphinha renews to 2030",
     "match": r"raphinha.*(renew|renov|extend|prolong|2030|contract)|(renew|renov|extend|prolong).*raphinha"},
    {"id": "rodri-injury", "label": "Rodri injury",
     "match": r"rodri.*(injur|out|lesi|4 weeks|semanas)|(injur|lesi).*rodri"},
]
TOPICS_LAST = [  # broad topics: checked only after match stories
    {"id": "ballon-dor", "label": "Ballon d'Or 2026",
     "match": r"ballon|bal[oó]n de oro|\bkane\b"},
    {"id": "balde-gavi", "label": "Balde and Gavi exit talk",
     "match": r"bald[eé]|gavi"},
    {"id": "january-window", "label": "January transfer window",
     "match": r"january|enero|mercato|lukeba|bastoni|hincapi|centre-back|center-back|new cb|d[eé]fenseurs"},
]

# Words that make a title read like match coverage rather than transfer talk.
MATCH_SIGNAL = (r"\bvs?\.?\b|\bv\b|contra|against|face|preview|previa|review|highlights|resumen|"
                r"\d\s?[-–]\s?\d|watch|reaction|r[ée]action|beat|win|loss|lose|defeat|victory|victoire|"
                r"draw|clash|match|game|partido|jornada|press|rueda|u19|youth|ldc|ucl|champions|"
                r"destroy|smash|humil|outsmart|ratings|derbi|derby|tomorrow|ma[ñn]ana")
OPPONENTS = [  # (display name, pattern)
    ("Real Madrid", r"cl[aá]sico"), ("Atlético Madrid", r"atl[eé]tico|atleti\b|simeone"),
    ("Athletic Club", r"athletic (club|bilbao)"), ("Real Sociedad", r"real sociedad"),
    ("Villarreal", r"villarreal"), ("Real Betis", r"\bbetis\b"), ("Sevilla", r"\bsevilla\b"),
    ("Valencia", r"\bvalencia\b(?! basket)"), ("Girona", r"\bgirona\b(?!.*b[aà]squet)"), ("Celta", r"\bcelta\b"),
    ("Osasuna", r"osasuna"), ("Getafe", r"getafe"), ("Rayo Vallecano", r"\brayo\b"),
    ("Mallorca", r"mallorca"), ("Alavés", r"alav[eé]s|alavez"), ("Espanyol", r"espanyol|derbi barcelon"),
    ("Elche", r"\belche\b"), ("Levante", r"levante"), ("Real Oviedo", r"oviedo"),
    ("Racing Santander", r"\bracing\b"), ("Deportivo", r"deportivo de la coru|\bdepor\b"),
    ("Aston Villa", r"aston villa|villa u19|\bemery\b"), ("PSG", r"\bpsg\b|paris saint"),
    ("Manchester City", r"man(chester)? city"), ("Bayern Munich", r"bayern"),
    ("Inter", r"\binter\b(?! miami)"), ("Juventus", r"juventus|\bjuve\b"), ("AC Milan", r"\bmilan\b"),
    ("Napoli", r"napoli"), ("Arsenal", r"arsenal"), ("Chelsea", r"chelsea"), ("Liverpool", r"liverpool"),
    ("Manchester United", r"man(chester)? united|man utd"), ("Tottenham", r"tottenham|spurs"),
    ("Newcastle", r"newcastle"), ("Borussia Dortmund", r"dortmund"), ("Leverkusen", r"leverkusen"),
    ("Benfica", r"benfica"), ("Porto", r"\bporto\b"), ("Sporting CP", r"sporting (cp|lisbon)"),
    ("Ajax", r"\bajax\b"), ("PSV", r"\bpsv\b"), ("Club Brugge", r"brugge|bruges"), ("Monaco", r"monaco"),
    ("Marseille", r"marseille"), ("Atalanta", r"atalanta"), ("Galatasaray", r"galatasaray"),
    ("Olympiacos", r"olympiacos"), ("Slavia Prague", r"slavia"), ("Copenhagen", r"copenhagen"),
    ("Celtic", r"\bceltic\b"), ("Eintracht Frankfurt", r"frankfurt"), ("RB Leipzig", r"leipzig"),
]


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("é", "e").replace("á", "a")).strip("-")


MATCH_STORIES = [{"id": "vs-" + _slug(name), "label": "El Clásico" if name == "Real Madrid" else f"Barça vs {name}",
                  "kind": "match", "match": pat,
                  # "clásico" is itself a match word, so it needs no extra signal
                  "signal": None if "cl[aá]sico" in pat else MATCH_SIGNAL} for name, pat in OPPONENTS]
STORIES = ([dict(t, kind="topic") for t in TOPICS_FIRST] + MATCH_STORIES
           + [dict(t, kind="topic") for t in TOPICS_LAST])
for s in STORIES:
    s["re"] = re.compile(s["match"], re.I)
    s["signal_re"] = re.compile(s["signal"], re.I) if s.get("signal") else None

# ---- Thresholds ----------------------------------------------------------------
BREAKOUT_RATIO = 2.5       # views >= 2.5x the channel's typical video
BREAKOUT_MIN_VIEWS = 1000  # ignore tiny channels where 3 extra viewers is "2.5x"
BASELINE_MIN_AGE_H = 48    # only videos at least 2 days old set the typical number
LONG_SECONDS = 20 * 60     # "Longs" = over 20 minutes
