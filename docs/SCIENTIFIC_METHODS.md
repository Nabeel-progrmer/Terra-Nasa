# Scientific methods and data handling

TERRA follows an evidence-first approach to scientific interpretation.

## Core principles

- Observations are distinguished from interpretations.
- Data sources are recorded with provenance metadata.
- Forecasts and model outputs are clearly labeled as such.
- Uncertainty is communicated rather than hidden.
- Correlation is not presented as causation.

## Implemented methods

- Regional change analysis uses day-weighted annual values from NASA POWER monthly MERRA-2 reanalysis estimates, a Theil–Sen slope, a two-sided Mann–Kendall test with tie correction, Benjamini–Hochberg adjusted q-values, and a separately labeled approximate ordinary-least-squares slope interval.
- Weather panels display provider forecast/model fields with units and timestamps; they do not infer local station observations.
- Space Explorer labels standard-atmosphere calculations as model output and solar-system ephemerides as local approximate calculations.

Seasonal decomposition, moving-average trend smoothing, generic anomaly detection, and correlation analysis are not currently exposed as implemented scientific workflows.

## Operational constraints

- Real analyses depend on real source data and valid time ranges.
- Missing data must be tracked and reported.
- Historical datasets must be normalized before calculations.
- Statistical summaries must not imply certainty without adequate coverage.

## Reporting standards

Each report should capture dataset, region, time range, units, retrieval time, and source limitation notes.

## Regional change analysis (`/api/change-analysis`)

The guided change workspace currently analyzes four NASA POWER monthly point variables: near-surface air temperature (`T2M`), corrected precipitation rate (`PRECTOTCORR`), 2 m relative humidity (`RH2M`), and 10 m wind speed (`WS10M`). This is a deliberately bounded, real-data workflow rather than a claim that all Earth science mission products are already catalogued.

NASA POWER meteorological values are based on NASA GMAO MERRA-2 reanalysis. They are gridded model/reanalysis estimates informed by observations, not direct satellite pixel retrievals. Each preset coordinate samples its nearest model grid cell; results do not represent an area-weighted regional mean. See the [NASA POWER monthly API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/) and [meteorological data-source notes](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/).

### Processing and trend estimates

- The monthly API is requested separately for each selected coordinate. Invalid sentinel values and missing months are omitted; there is no interpolation or synthetic fill.
- A calendar year's value is the day-weighted mean of available monthly values. Years with fewer than 10 valid months are excluded from the trend calculations. Coverage is the fraction of valid months across included years.
- The reported rate and direction use the Theil–Sen median pairwise slope against actual calendar years, so missing years do not change the time scale. Period change is the Sen rate multiplied by the span between first and last valid years.
- Relative change is suppressed for Celsius temperature because a percentage ratio in Celsius is not meaningful. It is only shown for ratio-scale precipitation rate, relative humidity, and wind speed when the first value is nonzero.
- A two-sided Mann–Kendall test with tie correction assesses monotonic trend. P-values use the normal approximation. Benjamini–Hochberg adjusted q-values are calculated across the locations selected in that analysis; “evidence detected” means q < 0.05 for this test family only.
- The separately labeled 95% interval is an approximate ordinary least-squares slope interval. It is not a confidence interval for the Theil–Sen slope and relies on ordinary regression assumptions, including independent errors and a suitable residual model. Neither statistic corrects for temporal autocorrelation. Spatial dependence, measurement/model uncertainty, multiple selections across separate analyses, statistical power, and practical significance are not resolved by this first workflow.

An inconclusive test is not evidence that no change occurred. A statistically significant trend does not establish that its magnitude is practically important, that another location shares the trend, or that a particular process caused it.
