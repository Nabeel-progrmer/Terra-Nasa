# TERRA data sources and provenance

This platform prioritizes public, free, and traceable data sources whenever possible. No fabricated observations or synthetic scientific metrics are allowed.

## Core sources

### Open-Meteo
- Purpose: weather, climate normals, historical conditions.
- Access: https://open-meteo.com/
- Forecast API documentation: https://open-meteo.com/en/docs
- Authentication: none required for public API use.
- Rate limits: generous for typical browser/server use; respect provider guidance.
- Data: current weather-model fields, hourly and seven-day forecasts.
- Provenance: TERRA shows the requested coordinates, provider condition timestamp, retrieval timestamp, source, units, and forecast/model disclaimer. Weather data is not presented as a local station observation.
- Interpretation: apparent temperature is Open-Meteo's perceived-comfort estimate combining temperature, wind chill, relative humidity, and solar radiation. TERRA computes air-temperature minus dew point to describe the moisture/saturation context; it does not claim that this alone causes precipitation. Hourly precipitation probability follows the provider's ensemble estimate for more than 0.1 mm in that hour. Cloud cover and a single pressure value are not used to assert a causal weather system.
- Visualization: hourly chart points are taken directly from the returned forecast timeline. Missing provider values remain blank; TERRA does not interpolate, fabricate, or silently fill them.

### Open-Meteo Geocoding / GeoNames
- Purpose: user-submitted place-name search in Earth Explorer.
- Access: https://open-meteo.com/en/docs/geocoding-api
- Authentication: no key is used by TERRA.
- Data: bounded search results with place names, country/region labels, and coordinates from GeoNames through Open-Meteo.
- Privacy and interpretation: requests are sent only after the user submits a search. Matching can be ambiguous and coordinates are not a high-precision address locator; the user selects a result before TERRA uses its coordinates.

### USGS Earthquake Hazards Program
- Purpose: earthquake events and hypocenter metadata.
- Access: https://earthquake.usgs.gov/
- Authentication: none required.
- Data: GeoJSON feed, event magnitude, depth, place, time, and source metadata.
- Provenance: always display the source and event time.

### NASA GIBS / EOSDIS
- Purpose: Earth observation basemap and imagery overlays.
- Access: https://nasa-gibs.github.io/gibs-api-docs/
- Authentication: typically none for public tiles.
- Data: MODIS, VIIRS, and related products where available; TERRA's Earth Explorer includes Aura OMI DOAS v3 standard total-column ozone imagery (`OMI_Ozone_DOAS_Total_Column`).
- Provenance: TERRA reads the current product time dimension from the public WMTS capabilities document, then labels the actual latest advertised image date and projection. The available date may lag the current day. Image colors are not point-level numeric values or health guidance.

### NASA POWER Monthly API / MERRA-2
- Purpose: historical monthly point series for T2M, PRECTOTCORR, RH2M, and WS10M in the regional change-analysis workspace.
- Access: https://power.larc.nasa.gov/docs/services/api/temporal/monthly/
- Authentication: none required for the public API.
- Data: NASA POWER meteorological analysis-ready values based on NASA GMAO MERRA-2 reanalysis. These are gridded reanalysis estimates, not direct satellite retrievals.
- Spatial/temporal support: a point request returns the nearest grid cell, not a regional mean; the workspace calculates day-weighted annual values from monthly records and requires at least 10 valid months per year.
- Provenance and limitations: the analysis records selected coordinates, period, dataset, request time, valid-month coverage, processing method, trend method, and significance caveats. See [SCIENTIFIC_METHODS.md](./SCIENTIFIC_METHODS.md).

### NOAA / NWS / SWPC
- Purpose: space-weather observations, geomagnetic indices, and official messages.
- Access: https://www.swpc.noaa.gov/ and https://services.swpc.noaa.gov/
- Authentication: no key required for the integrated public products.
- Integrated products: NOAA planetary Kp index, Kyoto Dst index, GOES 0.1–0.8 nm X-ray flux, one-hour propagated solar-wind data, and recent SWPC messages.
- Limitations: products have different cadences and timestamps. The propagated solar-wind product is an estimate propagated toward Earth, not a direct measurement at Earth. Recent messages shown by TERRA are not asserted to be active warnings.

### U.S. Standard Atmosphere, 1976
- Purpose: reference atmospheric temperature, pressure, and density profiles.
- Access: [NASA NTRS report](https://ntrs.nasa.gov/citations/19770009539).
- Authentication: none.
- Data: calculated model values from sea level through 84.852 geopotential km.
- Limitations: model output is not local weather or an atmospheric measurement. The current implementation does not model thermosphere, exosphere, ionosphere, or magnetosphere conditions.

### NASA/JPL Near-Earth Object Web Service (NeoWs)
- Purpose: upcoming close approaches of cataloged near-Earth objects.
- Access: https://api.nasa.gov/neo/rest/v1/feed
- Authentication: NASA API key recommended; the service uses `DEMO_KEY` as a low-quota fallback.
- Data: close-approach dates, relative speeds, miss distances, diameter estimates, and NASA/JPL potentially hazardous object screening flags.
- Limitations: approach and diameter data have uncertainties. A close approach or potentially hazardous classification does not mean an impact is predicted. TERRA does not calculate impact probabilities.

### NASA Planetary Data System Registry
- Purpose: browse planetary mission archive bundles, collections, and products.
- Access: https://pds.mcp.nasa.gov/api/search/1/
- API documentation: https://pds.mcp.nasa.gov/api/search/1/api-docs
- Authentication: none required for public registry records.
- Data: product LIDs, titles, product classes, versions, archive time metadata, member records, and provider label links. TERRA's browser example is the Mars 2020 RIMFAX bundle. A separate calibrated product example decodes a PDS4 table with repeated RIMFAX sounding samples from the source label and CSV.
- Decoder limits: decoding is opt-in and limited to a single PDS4 delimited observation table with supported ASCII field types and at most one flat repeated numeric field group. Label and data downloads use an HTTPS PDS-host allowlist, redirect checks, explicit byte limits, and bounded returned rows. Binary products, nested groups, quoted fields, ambiguous labels, and unsupported delimiters are rejected with an explanation.
- Interpretation: TERRA decodes values according to the provider's label; it does not recalibrate or perform a scientific interpretation of the instrument readings. Sample arrays may be evenly decimated for display, and their original sample indices are preserved. The decoded RIMFAX example is calibrated radar sounding data, not a complete radargram product.

### Astronomy Engine
- Purpose: local solar-system ephemerides, apparent horizontal coordinates, and rise/set calculations.
- Access: https://github.com/cosinekitty/astronomy
- Authentication: no key; calculations run in the TERRA server and do not call an astronomy data provider.
- Data: calculated Sun, Moon, and planet right ascension/declination, azimuth/altitude, distance, visual magnitude, illuminated fraction, and next 24-hour rise/set times.
- Limitations: these are approximate calculations, not a JPL Horizons result or navigation-grade ephemeris. TERRA makes no numeric accuracy guarantee. Rise/set uses the library's typical 34 arcminute atmospheric-refraction correction. The geometric sky panel does not model clouds, haze, light pollution, obstructions, object contrast, or real-time weather. The interface accepts dates from 1900 through 2100.

### NASA Exoplanet Archive
- Purpose: confirmed exoplanet catalog search.
- Access: https://exoplanetarchive.ipac.caltech.edu/
- TAP documentation: https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html
- Authentication: public TAP API; no key required.
- Data: selected columns from the `ps` Planetary Systems table, using default solutions, with a fixed query and a maximum of 50 results.
- Limitations: this is a catalog of exoplanets, not a complete deep-space-object catalog. Missing measurements remain null; archive solutions and values may change over time.

### OpenStreetMap
- Purpose: map basemap and geographic context.
- Access: https://www.openstreetmap.org/
- Licensing: comply with tile usage policies and attribution requirements.

## Internal platform policy

- All values must be traceable to a real source or a clearly marked unavailable state.
- Data freshness is displayed for every live panel.
- Missing credentials are handled with explicit feature gating instead of fake data.
- No frontend code may expose private tokens or secrets.
