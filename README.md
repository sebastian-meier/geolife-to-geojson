# geolife-to-geojson
PhD #01 - Transform GeoLife's plt files into GeoJson

## Intro

The GeoLife dataset (see below) is stored in a plt file, which are essentially trajectories stored in CSV files. While those are not very handy to use. This script transforms those plt files in GeoJSONs. The output format is inspired by the Moves application's storyline format. The output data consists of a GeoJson FeatureCollection which contains points for locations and MultiLineStrings for trajectories between locations. When activity classification data is available the MultiLineString is split by activity type and the according activity labels are provided.

## Usage

Download the GeoLife data from the website below and unzip the data. Then simply call the index.js file and provide the following parameters (only the first parameter is required).

```
node index.js source=./DATA/
```

**source** (required) : path to input folder (GeoLife download folder)
**target** (optional) : path to output folder (is created if it does not exist) / default: ./export/
**simplify** (optional) : path to output folder (is created if it does not exist) / default: 0.00001
**recording_gap** (optional) : when is a time gap a recording gap / default 5*60 > (5 Minutes)
**loc\_spaceline\_threshold** (optional) : spatial threshold to be occupied in a time _loc\_spacetime\_threshold_ to be accounted as a location / default: 10 (meters)
**loc\_spacetime\_threshold** (optional) : temporal threshold to be spend in an area _loc\_spaceline\_threshold_ to be accounted as a location / default: 15*60 (15 minutes)

_Note: This can be heavy on your machine as the transformation makes use of child processes and launches one process per available cpu. In addition the memory is already increased to 4GB, due to the large files. Be aware, that if reducing simplify files get bigger and the memory might need to be further increased._

The above script will create one geojson file per subject. In addition a summary.json is created providing an overview over the transformed data.

## About GeoLife

From April 2007 to August 2012 Microsoft Research Asia's GeoLife project collected trajectories from 182 users. In addition, some of the trajectories contain activity classification data. The project was led by senior research manager Yu Zheng.

The raw data can be downloaded here:
https://www.microsoft.com/en-us/download/details.aspx?id=52367

Publications by the GeoLife team can be found here:
https://www.microsoft.com/en-us/research/project/geolife-building-social-networks-using-human-location-history/