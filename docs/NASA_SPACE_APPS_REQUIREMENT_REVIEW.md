# NASA Space Apps 2026 challenge fit

This review maps the supplied Advanced Earth Science challenge brief to the current TERRA implementation. It describes implemented scope; it is not NASA endorsement, scientific certification, or a guarantee of provider accuracy.

## Challenge objectives

| Objective | TERRA implementation | Assessment |
| --- | --- | --- |
| Select Earth science variables that can be investigated for trends | Four NASA POWER monthly meteorological variables are selectable: T2M, PRECTOTCORR, RH2M, and WS10M. A simple, disclosed keyword suggestion can recommend one from a user's optional question. | Implemented with a deliberately bounded catalog; no broad mission-variable discovery/search. |
| Obtain data for a particular region | Users can analyze one or more of six preset coordinates. NASA POWER returns the nearest model grid point for each coordinate. | Implemented for those points; no custom coordinates, polygon regions, or area-weighted averages. |
| Create and visualize a sufficiently long time series | Users can choose a period of at least 10 years from 1981 through the latest year the workflow permits. The page plots yearly values for each selected point and allows CSV export. | Implemented. A year contributes only when at least 10 monthly values are valid. |
| Estimate change rate and assess trend evidence | The workflow reports Theil–Sen slope, estimated period change, a two-sided Mann–Kendall test with tie correction, and Benjamini–Hochberg adjusted q-values across successfully analyzed selected locations. It separately reports an approximate OLS slope interval. | Implemented as a basic statistical analysis. Assumptions and limitations are displayed; significance is not causality or practical importance. |
| Help students and the public understand variables | Variable cards provide short plain-language descriptions and units; results include a method and limitation explanation. | Implemented, but the available variables remain intentionally limited. |

## Interpretation and data limits

- NASA POWER meteorological monthly values used here are MERRA-2 reanalysis estimates informed by observations. They are not direct satellite pixel measurements or ground-station readings. Each selected coordinate maps to a nearest model grid point, not a whole-region mean.
- Missing or sentinel months are omitted; no values are interpolated. Annual means weight valid monthly means by calendar days. Years with fewer than 10 valid months are excluded from trend estimates. Coverage is still reported so incomplete records remain visible.
- The Sen slope uses actual calendar-year gaps. The OLS interval is for the OLS slope, not the Sen slope. The interval uses an approximate Student-t critical value and depends on regression assumptions.
- Mann–Kendall p-values use a normal approximation with tie correction and continuity correction. Serial correlation is not corrected. The multiple-test adjustment applies within one request to the locations successfully analyzed; it does not adjust for repeated user analyses or variable selection.
- A statistically significant result is evidence against the test's no-monotonic-trend null under these assumptions. It does not identify a cause, demonstrate practical importance, or establish the same result for a surrounding region.
- Seasonal adjustment, nonlinear trend models, custom region averaging, cross-variable causal analysis, and broad mission catalog search are not implemented.

## Optional challenge ideas

The brief's potential considerations are optional. TERRA includes explanatory variable descriptions, a question-based keyword suggestion, preselected example points, and an exportable time series. It does not yet provide a curated set of narrated demonstrations or location-characteristic-based recommendations.

## Verification

Automated trend fixtures check a known linear slope, the OLS interval, missing-month coverage, and API validation. Other route tests use deterministic provider fixtures. They do not prove correctness for every live provider response or replace independent scientific review. See [the verification report](./TESTING_REPORT.md), [scientific methods](./SCIENTIFIC_METHODS.md), and [NASA POWER methodology](https://power.larc.nasa.gov/docs/methodology/).
