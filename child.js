const v8 = require('v8')
v8.setFlagsFromString('--max_old_space_size=4096')
v8.setFlagsFromString('--max_executable_size=4096')

let fs = require('fs'),
  moment = require('moment'),
  d3 = require('d3'),
  turf = require('turf')

let config = {
  id : false,
  source  : false,
  target  : './EXPORT/',
  simplify: 0.00001,
  recording_gap : 5*60,
  loc_spaceline_threshold : 10,
  loc_spacetime_threshold : 15*60
}

process.on('message', (m) => {
  switch(m.task){
    case 'setId':
      for(let key in config){
        config[key] = m[key]
      }
      process.send({ task: 'init', id: config.id })
    break;
    case 'execute':
      processSubject(m.subject)
    break;
  }
})

let short_key = {
  'Start Time': 'start',
  'End Time': 'end',
  'Transportation Mode': 'activity'
}

let movesTimestamp = {
  long : 'YYYYMMDDTHHmmssZZ',
  short: 'YYYYMMDDTHHmmss',
  date: 'YYYYMMDD'
}

function processSubject(subject) {
  if(subject != '.DS_Store'){

    //Check if labels exists and, if so, parse them
    let labels = false
    let labels_path = config.source + subject + '/labels.txt'
    if (fs.existsSync(labels_path)) {
      labels = []
      label_data = (fs.readFileSync(labels_path, 'utf8')).split('\n')
      let t_labels = label_data[0].split('\t')
      label_data.forEach( (row, i) => {
        if(i > 0){
          if(row.length >= 1){
            let obj = {}
            row = row.split('\t')
            t_labels.forEach((key,ii) => {
              if((ii in row)) obj[short_key[key.trim()]] = (key.indexOf('Time')>=0)?moment(row[ii].split('/').join('-')):row[ii].trim()
            })
            labels.push(obj)
          }
        }
      })
    }

    //Combine all corresponding plts into one long timeline
    let trajectory_path = config.source + subject + '/Trajectory'
    let cTrajectories = [], trajectories = fs.readdirSync(trajectory_path)
    trajectories.forEach( (trajectory) => {
      let trajectory_lines = (fs.readFileSync(trajectory_path + '/' + trajectory, 'utf8')).split('\n')
      trajectory_lines.forEach((line,i) => {
        if(i>5){
          line = line.split(',')
          //check for empty entries
          if(line[5] && line[6]){
            //reduce the data by making sure entries are either more than 1 minute apart or more than 5 meters
            var t_trajectory = {
              lat:parseFloat(line[0]),
              lon:parseFloat(line[1]),
              alt:parseFloat(line[3]),
              time:line[5].trim()+' '+line[6].trim()
            }

            if(cTrajectories.length<1){
              cTrajectories.push(t_trajectory)
            }else{
              let l_trajectory = cTrajectories[cTrajectories.length-1]

              let dist = Math.round(turf.distance(turf.point([t_trajectory.lon,t_trajectory.lat]),turf.point([l_trajectory.lon,l_trajectory.lat]))*1000)

              if(dist > 5){
                cTrajectories.push(t_trajectory)  
              }else{
                let diff = Math.round(moment(t_trajectory.time).diff(moment(l_trajectory.time))/1000)
                if(diff > 60){
                  cTrajectories.push(t_trajectory)  
                }else{
                  //sets are less than 5 meters and 60 seconds apart
                }
              }
            }
            
          }
        }
      })
    })

    //split the trajectories at every time gap
    let trips = [], trip = [], last = false
    cTrajectories.forEach((trajectory, i) => {
      if(i === 0){
        trip.push(trajectory)
      }else{
        let diff = Math.round(moment(trajectory.time).diff(moment(last.time))/1000)
        if(diff > config.recording_gap){
          trips.push(trip)
          trip = []
        }
        trip.push(trajectory)
      }
      last = trajectory
    })
    trips.push(trip)

    //calculate the spatial outliers
    let dists = [], dist_keys = {}
    trips.forEach( trip => {
      trip.forEach( (trajectory, i) => {
        if(i>0){
          let dist = Math.round(turf.distance(turf.point([trajectory.lon,trajectory.lat]),turf.point([last.lon,last.lat]))*1000)
          if(!(dist in dist_keys)){
            dists.push(dist)
            dist_keys[dist] = 1
          }
        }
        last = trajectory
      })
    })
    let dist_outliers = calcOutliers(dists), dist_max = d3.max(dists)

    if(dist_outliers[1] != dist_max){
      //clean spatial outliers
      trips.forEach(trip => {
        let temp_trips = [], temp_trip = []
        trip.forEach( (trajectory, i) => {
          if(i>0){
            let dist = Math.round(turf.distance(turf.point([trajectory.lon,trajectory.lat]),turf.point([last.lon,last.lat]))*1000)
            if(dist > dist_outliers[1]){
              let n_lon = last.lon+(trajectory.lon-last.lon)/dist*dist_outliers[1],
              n_lat = last.lat+(trajectory.lat-last.lat)/dist*dist_outliers[1]

              let change = true              

              if(i<trip.length-2){
                let n_dist = Math.round(turf.distance(turf.point([n_lon,n_lat]),turf.point([trip[i+1].lon,trip[i+1].lat]))*1000)
                if(n_dist > dist_outliers[1]){
                  change = false
                }
              }

              if(change){
                trajectory.lat = n_lat
                trajectory.lon = n_lon
              }
            }
          }
          last = trajectory
        })
      })
    }

    clean_trips = []
    trips.forEach((trip,ti) => {
      let points = [], temp_trips = [], temp_trip = [], i = 0, last_added = false, last_added_point = 0
      while(i<trip.length){
        points = [[trip[i].lon,trip[i].lat]]
        let j = i+1
        if(j===trip.length)i=trip.length
        while(j<trip.length){
          points.push([trip[j].lon,trip[j].lat])
          if(inBounds(points)){
            let diff = Math.round(moment(trip[i].time).diff(moment(trip[j].time))/1000)
            if(diff > config.loc_spacetime_threshold){
              let k = j+1
              if(k===trip.length){
                j=trip.length
                i++
              }
              while(k<trip.length){
                points.push([trip[k].lon,trip[k].lat])
                if(!inBounds(points) || k==(trip.length-1)){
                  for(let l = i; l<k; l++){
                    temp_trip.push(trip[l])
                    if(l == (trip.length - 1)){
                      last_added = true
                    }
                    last_added_point = l
                  }
                  temp_trips.push(temp_trip)
                  i = k
                  k = trip.length
                  j = trip.length
                }else{
                  k++
                }
              }
            }else{
              j++
              if(j==trip.length){
                i++
              }
            }
          }else{
            i++
            j = trip.length
          }
        }
      }
      if(temp_trips.length === 0){
        clean_trips.push(trip)
      }else{
        if(!last_added){
          for(let i = last_added_point; i<trip.length; i++){
            temp_trip.push(trip[i])
          }
          temp_trips.push(temp_trip)
        }
        clean_trips = clean_trips.concat(temp_trips)
      }
    })
    trips = clean_trips

    //Check if a segment is a location stay and check if last position and first of next trip are same (assume in between is a location)
    clean_trips = []
    trips.forEach((trip, i) => {
      if(i===0){
        //Add the first point as a location
        clean_trips.push({
          type:'location',
          trajectories:[trip[0]]
        })
      }

      let points = []
      trip.forEach(trajectory => {
        points.push([trajectory.lon, trajectory.lat])
      })

      let type = 'trip'
      if(inBounds(points)){
        let diff = Math.round(moment(trip[0].time).diff(moment((trip[trip.length-1]).time))/1000)
        if(diff > config.loc_spacetime_threshold){
          type = 'location'
        }
      }

      clean_trips.push({
        type:type,
        trajectories:(type=='trip')?[{activity:'transport',trajectories:trip}]:trip
      })
      
      if(i<(trips.length-1)){
        let add = false
        pionts = [[trip[(trip.length-1)].lon, trip[(trip.length-1)].lat], [trips[i+1][0].lon, trips[i+1][0].lat]]
        if(inBounds(points)){
          let diff = Math.round(moment(trip[(trip.length-1)].time).diff(moment(trips[i+1][0].time))/1000)
          if(diff > config.loc_spacetime_threshold){
            add = true
            clean_trips.push({
              type:'location',
              trajectories:[trip[(trip.length-1)], trips[i+1][0]]
            })
          }
        }
        if(!add){
          //last and first point of next trip are not the same location, add them as separate locations
          clean_trips.push({
            type:'location',
            trajectories:[trip[(trip.length-1)]]
          })
          clean_trips.push({
            type:'location',
            trajectories:[trips[i+1][0]]
          })
        }
      }else{
        //Add last point as location
        clean_trips.push({
          type:'location',
          trajectories:[trip[(trip.length-1)]]
        })
      }
    })
    trips = clean_trips

    //If labels exist, apply them to the trajectories, if required split into multiple trajectories
    if(labels){
      clean_trips = []
      let label_count = 0
      //2007/06/26 11:32:29 2007/06/26 11:40:29 bus
      trips.forEach(trip => {
        if(trip.type == 'location'){
          clean_trips.push(trip)
        }else{
          let t_trip = {
            type:'trip',
            trajectories:[]
          }

          let t_trajectory = {
            activity:'transport ',
            label:false,
            trajectories:[]
          }
          
          trip.trajectories.forEach( trajectory => {
            trajectory.trajectories.forEach( t => {
              while(label_count<labels.length && moment(t.time).diff(labels[label_count].end) > 0){
                label_count++;
              }
              if(label_count>=labels.length){
                if(t_trajectory.label != false){
                  t_trip.trajectories.push(t_trajectory)
                  t_trajectory = {
                    activity:trajectory.activity,
                    label:false,
                    trajectories:[]
                  }
                }
                t_trajectory.trajectories.push(t)
              }else{
                if(moment(t.time).diff(labels[label_count].start) < 0){
                  if(t_trajectory.label == false){
                    t_trajectory.trajectories.push(t)
                  }else{
                    if(t_trajectory.trajectories.length>=1){
                      t_trip.trajectories.push(t_trajectory)
                    }
                    t_trajectory = {
                      activity:trajectory.activity,
                      label:false,
                      trajectories:[t]
                    }
                  }
                }else{
                  if(t_trajectory.label != label_count){
                    if(t_trajectory.trajectories.length>=1){
                      t_trip.trajectories.push(t_trajectory)
                    }
                    t_trajectory = {
                      activity:labels[label_count].activity,
                      label:label_count,
                      trajectories:[]
                    }
                  }
                  t_trajectory.trajectories.push(t)
                }
              }
            })
          })
          if(t_trajectory.trajectories.length >= 1){
            t_trip.trajectories.push(t_trajectory)
          }
          clean_trips.push(t_trip);
        }
      })
      trips = clean_trips
    }

    //Transform everything into the moves story-format
    let features = [], place_id = 0
    trips.forEach( trip => {
      let feature
      if(trip.type == 'location'){
        let points = []
        trip.trajectories.forEach(trajectory => {
          points.push(turf.point([trajectory.lon, trajectory.lat]))
        })
        
        let center = turf.center(turf.featureCollection(points)) 

        feature = turf.point(center.geometry.coordinates)
        feature.properties['type'] = "place"
        feature.properties['startTime'] = moment(trip.trajectories[0].time).format(movesTimestamp.long)
        feature.properties['endTime'] = moment(trip.trajectories[(trip.trajectories.length-1)].time).format(movesTimestamp.long)
        feature.properties['place'] = {id:place_id++,type:'unknown',location:{lat:center.geometry.coordinates[1],lon:center.geometry.coordinates[0]}}
        feature.properties['activities'] = []
        feature.properties['lastUpdate'] = moment(trip.trajectories[(trip.trajectories.length-1)].time).format(movesTimestamp.short)+'Z'
        feature.properties['date'] = moment(trip.trajectories[0].time).format(movesTimestamp.date)

      }else{
        let activities = [], lineStrings = []

        trip.trajectories.forEach( segment => {
          let points = []
          segment.trajectories.forEach(trajectory => {
            points.push([trajectory.lon, trajectory.lat])
          })
          lineStrings.push(points)

          let line = turf.lineString(points)

          activities.push({
            activity:segment.activity,
            group:segment.activity,
            startTime:moment(segment.trajectories[0].time).format(movesTimestamp.long),
            endTime:moment(segment.trajectories[(segment.trajectories.length-1)].time).format(movesTimestamp.long),
            duration:Math.round(moment(segment.trajectories[(segment.trajectories.length-1)].time).diff(moment(segment.trajectories[0].time))/1000),
            distance:Math.round(turf.lineDistance(line)*1000)
          })
        })

        feature = turf.simplify(turf.multiLineString(lineStrings), config.simplify, true)
        feature.properties['type'] = "move"
        feature.properties['startTime'] = activities[0].startTime
        feature.properties['endTime'] = activities[(activities.length-1)].endTime
        feature.properties['activities'] = activities
        feature.properties['lastUpdate'] = moment(trip.trajectories[(trip.trajectories.length-1)].trajectories[trip.trajectories[(trip.trajectories.length-1)].trajectories.length-1].time).format(movesTimestamp.short)+'Z'
        feature.properties['date'] = moment(trip.trajectories[0].trajectories[0].time).format(movesTimestamp.date)

      }
      features.push(feature)
    })

    let geojson = turf.featureCollection(features)

    fs.writeFileSync(config.target+subject+'.geojson', JSON.stringify(geojson, null, 4));

    process.send({ task: 'done', id: id, activity:(labels)?true:false, name:subject, count:cTrajectories.length, elements:features.length })
  }else{
    process.send({task:'ignore', id:id })
  }  
}

function inBounds(points){
  let bb = turf.bbox(turf.multiPoint(points)),
    d1 = turf.distance(turf.point([bb[0],bb[1]]),turf.point([bb[0],bb[3]]))*1000,
    d2 = turf.distance(turf.point([bb[0],bb[1]]),turf.point([bb[2],bb[1]]))*1000
  
  if(d1 > config.loc_spaceline_threshold || d2 > config.loc_spaceline_threshold)  {
    return false
  }
  return true
}

function calcOutliers (d) {
  d.sort(d3.ascending)

  //quartiles
  let q = [
    d3.quantile(d, .25),
    d3.quantile(d, .5),
    d3.quantile(d, .75)
  ]

  let k = 1.5,
      iqr = (q[2] - q[0]) * k,
      i = -1,
      j = d.length

  while (d[++i] < q[0] - iqr);
  while (d[--j] > q[2] + iqr);

  return [d[i], d[j]]
}