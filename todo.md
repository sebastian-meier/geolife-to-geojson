/*console.log('diffs:')
//finding optimal number of clusters (max depth?) jenks instead
let time_hcluster = clusterfck.hcluster(time_cluster, "euclidean", "single")

let time_cluster = clusterfck.kmeans(diffs, 3)
time_cluster.forEach(cluster => {
  console.log(cluster.length, d3.min(cluster, function(d){return d[0]}), d3.max(cluster, function(d){return d[0]}), d3.median(cluster, function(d){return d[0]}), d3.mean(cluster, function(d){return d[0]}))
})

console.log('-------')
console.log('dists:')
let space_cluster = clusterfck.kmeans(dists, 3)
space_cluster.forEach(cluster => {
  console.log(cluster.length, d3.min(cluster, function(d){return d[0]}), d3.max(cluster, function(d){return d[0]}), d3.median(cluster, function(d){return d[0]}), d3.mean(cluster, function(d){return d[0]}))
})*/


//console.log(JSON.stringify(clusterfck.hcluster(dists, "euclidean", "single")))

//space diff close to zero is a location
//temporal outlier is a gap > if before and after gps are the similar its a location (?) introduce max time diff threshold
//spatial outlier after temporal, if spatial outlier try to remove and check if afterwards good, if not build point between next
//

//Visualize before and after...

/*
  identify gaps by big time diff > if still same position than location otherwise missing data

  detect locations and break rest into trips
    go through all test if to previous is within threshold if yes say break until breaks if time since first is outside time threshold than its a location
    create a list of locations and check if the location has been detected before and can therefore be reconnected, create uinque ids for the locations

  go through trips and check if is part of detected activity type if yes break trip apart

  for each trip or trip segment create a geojson feature
  simplify geojson feature, add meta data (start / end time) > see moves: http://mourner.github.io/simplify-js/

data.push({
  labels:labels
})

*/

//simplify(points, 2, true); //test simplification