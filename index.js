const v8 = require('v8')
v8.setFlagsFromString('--max_old_space_size=4096')
v8.setFlagsFromString('--max_executable_size=4096')

let config = {
  source  : false,
  target  : './EXPORT/',
  simplify: 0.00001,
  //Time gap between recordings
  recording_gap : 5*60, //minutes
  //Spatial Threshold to count as a location
  loc_spaceline_threshold : 10, // meters 2*radius
  //Temporal Threshold minimum time spend to be a location
  loc_spacetime_threshold : 15*60 // minutes
}

//importing command line arguments
for(let i = 2; i<process.argv.length; i++){
  let [key, value] = process.argv[i].split('=')
  if(key in config){
    config[key] = value
  }
}

//terminate script if no source path is supplied
if(!config.source){
  console.log('Please provide a source path.')
  process.exit()
}

['source','target'].forEach( t => {
  if(config[t].substr(-1,1) != '/'){ 
    config[t] += '/' 
  }
})

//require dependencies
let child_process = require('child_process'),
    fs = require('fs'),
    _progress = require('cli-progress'),
    //defines number of child processes
    numCPUs = require('os').cpus().length,
    //other variables
    children = [], 
    summary = [],
    count = 0,
    killed = 0,
    done = 0

//Check if output folder exists
if (!fs.existsSync(config.target)) {
  fs.mkdirSync(config.target);
}

//read source folder
let subjects = fs.readdirSync(config.source)

//initiate progress bar for command line
let progress_bar = new _progress.Bar({}, _progress.Presets.shades_classic)
    progress_bar.start(subjects.length, 0)

//initiate one child process per cpu
for(let i = 0; i<numCPUs; i++){
  let child = child_process.fork("child.js")
  children.push(child)
  child.on('message', message)
  //set ID of child process and pass down config parameters
  let param = { task: 'setId', id:i }
  for(let key in config){
    param[key] = config[key]
  }
  child.send(param)
}

//Handle incoming messages from the child processes
function message (m) {
  switch (m.task) {
    case 'init':
      nextTask(m)
    break;
    case 'ignore':
      done++
      progress_bar.update(done)

      nextTask(m)
    break;
    case 'done':
      summary.push({
        activity:m.activity,
        name:m.name,
        count:m.count,
        elements:m.elements
      })

      done++
      progress_bar.update(done)

      nextTask(m)
    break;
  }
}

//Loop through the subfolders until everything is done
function nextTask(m){
  count++
  if(count<subjects.length){
    children[m.id].send({task:'execute', subject:subjects[count]})
  }else{
    killed++
    if(killed === numCPUs){
      progress_bar.stop()
      fs.writeFileSync(config.target+'summary.json', JSON.stringify(summary, null, 4));
    }
    children[m.id].kill('SIGINT')
  }
}