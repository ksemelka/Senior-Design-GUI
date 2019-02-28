var ros;
var controlClient;

var tfClient;

var canvas;
var canvasWidth;
var ctx;

var currently_locked = false;

function resizeCanvas() {
  canvas.width = window.innerWidth;
}

function init() {
  ros = new ROSLIB.Ros({
    url : 'ws://192.168.10.145:9090'
  });

  $('#menu').css('opacity', '1');

  // If there is an error on the backend, an 'error' emit will be emitted.
  ros.on('error', function(error) {
    console.log(error);
    $('#connecting').hide();
    $('#error').show();
    $('#closed').hide();
    $('#connected').hide();
  });

  // Find out exactly when we made a connection.
  ros.on('connection', function() {
    console.log('Connection made!');
    $('#connecting').hide();
    $('#error').hide();
    $('#closed').hide();
    $('#connected').show();
  });

  ros.on('close', function() {
    console.log('Connection closed.');
    $('#connecting').hide();
    $('#error').hide();
    $('#closed').show();
    $('#connected').hide();
  });

  // Action Lib client for moving TurtleBot
  //---------------------
  controlClient = new ROSLIB.ActionClient({                                                
    ros : ros,
    serverName: '/robot_1/move_base',
    actionName: 'MoveBaseAction'                                      
  });

  // TF Client to receive position data of robot
  //---------------------
  // tfClient = new ROSLIB.TFClient({
  //   ros : ros,
  //   fixedFrame : 'robot_1/base_link',
  //   angularThres : 0.01,
  //   transThres : 0.01
  // });

  // tfClient.subscribe('robot_1/map', function(tf) {
  //   console.log('Got TF Message.');
  //   console.log(tf);
  //   // document.getElementById('x-position').innerHTML = tf.translation.x;
  //   // document.getElementById('y-position').innerHTML = tf.translation.y;
  // });

  //Subscribing to Robot Status Listener
  //----------------------
  const robot_status_listener = new ROSLIB.Topic({
      ros : ros,
      name : '/robot_state',
      messageType : 'turtlebot_mrs_msgs/RobotStatus'
  });

  // Then we add a callback to be called every time a message is published on this topic.
  robot_status_listener.subscribe(function(message) {
    const msg = JSON.stringify(message);
    console.log('Received message on ' + robot_status_listener.name + ': ' + msg);

    $('#battery_info').innerHTML = message['battery_info'];
    $('#ar_tag_position_x').innerHTML  = message['ar_tag_position_x'];
    $('#ar_tag_position_y').innerHTML  = message['ar_tag_position_y'];
    $('#robot_1_position_x').innerHTML  = message['robot_1_position_x'];
    $('#robot_1_position_y').innerHTML  = message['robot_1_position_y'];
    $('#robot_2_position_x').innerHTML  = message['robot_2_position_x'];
    $('#robot_2_position_y').innerHTML  = message['robot_2_position_y'];

    if (message['current_state'] === "Menu") {
      $('#menu').css('opacity', '1');
      $('#approach').css('opacity', '0.2');
      $('#lock').css('opacity', '0.2');
      $('#unlock').css('opacity', '0.2');
    } else if (message['current_state'] === "Approach") {
      $('#menu').css('opacity', '0.2');
      $('#approach').css('opacity', '1');
      $('#lock').css('opacity', '0.2');
      $('#unlock').css('opacity', '0.2');
    } else if (message['current_state'] === "Lock") {
      $('#menu').css('opacity', '0.2');
      $('#approach').css('opacity', '0.2');
      $('#lock').css('opacity', '1');
      $('#unlock').css('opacity', '0.2');
    } else if (message['current_state'] === "Unlock") {
      $('#menu').css('opacity', '0.2');
      $('#approach').css('opacity', '0.2');
      $('#lock').css('opacity', '0.2');
      $('#unlock').css('opacity', '1');
    } else {
      console.log('Error: ' + robot_status_listener.name + 'received \'' + message.state + '\' which doesn\'t match any states.');
    }

    $('#battery_info').innerHTML = message
  });

  //Subscribing to Robot Load Listener
  //--------------------------------
  const robot_load_listener = new ROSLIB.Topic({
    ros : ros,
    name : '/robot_load',
    messageType : 'std_msgs/Float32'
  });

  // Then we add a callback to be called every time a message is published on this topic.
  robot_load_listener.subscribe(function(message) {
    $('robot-load').innerHTML = message.data;
  });

  // Nav viewer
  //---------------------------------
  // Create the main viewer.
  var viewer = new ROS2D.Viewer({
    divID : 'map',
    width : 750,
    height : 550
  });

  // Setup the nav client.
  // const nav = NAV2D.OccupancyGridClientNav({
  //   ros : ros,
  //   rootObject : viewer.scene,
  //   viewer : viewer,
  //   continuous : true,
  //   topic : '/robot_1/map'
  // });

  const gridClient = new ROS2D.OccupancyGridClient({
    ros : ros,
    rootObject : viewer.scene,
    continuous : true,
    topic : '/robot_1/map'
  });

  gridClient.on('change', function(){
    viewer.scaleToDimensions(gridClient.currentGrid.width, gridClient.currentGrid.height);
    viewer.shift(gridClient.currentGrid.pose.position.x, gridClient.currentGrid.pose.position.y);
  });

  var imageTopic = new ROSLIB.Topic({
    ros : ros,
    name : '/robot_1/camera/image_raw/compressed',
    messageType : 'sensor_msgs/CompressedImage',
    throttle_rate : 166,
    queue_size : 0
  });

  imageTopic.subscribe(function(message) {
    // console.log("Got camera message");
    const imagedata = "data:image/jpg;base64," + message.data;

    const cam = document.getElementById("camera");
    const ctx = cam.getContext("2d");

    let image = new Image();
    image.onload = function() {
      ctx.drawImage(image, 0, 0);
    };
    image.src = imagedata;
  });

  // canvas = document.getElementById('camera');
  // if (canvas.getContext) {
  //   ctx = canvas.getContext("2d");

  //   window.addEventListener('resize', resizeCanvas, false);
  //   window.addEventListener('orientationchange', resizeCanvas, false);
  //   resizeCanvas();
  // }

  // Initialize timer
  const timer = document.getElementById("timer");
  aTimer = new Stopwatch(timer);
  aTimer.reset();
}

function stop() {
  $('#startButton').prop('disabled', false);
  $('#stopButton').prop('disabled', true);

  var stop = new ROSLIB.Topic({
    ros : ros,
    name : '/emergency_stop',
    messageType : 'std_msgs/Bool'
  });

  // Then we create the payload to be published.
  var stop_flag = new ROSLIB.Message({ data : true });

  // And finally, publish.
  stop.publish(stop_flag);

  aTimer.stop();
  aTimer.reset();
}

function start() {
  
  // document.getElementById("startButton").innerHTML = "Starting...";
  $('#startButton').prop('disabled', true);
  $('#stopButton').prop('disabled', false);
  aTimer.start();
}

function publish_lock_state() {
  let lock_topic = new ROSLIB.Topic({
    ros : ros,
    name : '/toggle_relay',
    messageType : 'std_msgs/Bool'
  });

  // Then we create the payload to be published.
  let lock_message;
  if (currently_locked) {
    lock_message = new ROSLIB.Message({data : false});
    currently_locked = false;
  }
  else {
    lock_message = new ROSLIB.Message({data : true});
    currently_locked = true;
  }

  // And finally, publish.
  lock_topic.publish(lock_message);

  if (currently_locked) {
    console.log("Magnet is now locked.");
  }
  else {
    console.log("Magnet is now unlocked.");
  }
  
}

function send_waypoint() {
  // let waypoints = $('coordinatesForm').serializeArray();

  let form = document.getElementById('coordinatesForm');
  let x = form.elements[0].value;
  let y = form.elements[1].value;
  let yaw = form.elements[2].value;

  // console.log(waypoints);

  // let x = waypoints['x-coord'];
  // let y = waypoints['y-coord'];
  // let yaw = waypoints['yaw'];

  // let waypoint_topic = new ROSLIB.Topic({
  //   ros : ros,
  //   name : '/robot_1/move_base/goal',
  //   messageType : 'move_base_msgs/MoveBaseActionGoal'
  // });

  console.log("Sending waypoint to robot:" + 
              "\n\tx: " + x + 
              "\n\ty: " + y +
              "\n\tyaw: " + yaw);

  //Create the goal
  let goal = new ROSLIB.Goal({
    actionClient : controlClient,
    goalMessage : {
      target_pose : {
        header : {
          frame_id : "robot_1/map"
        },
        pose : {
          position : {
            x: 0,
            y: 1,
            z: .263
          },
          orientation : {
            x: 0,
            y: 0,
            z: 0,
            w: 1
          }
        }
      }
    }
  });

  //Send the goal to the server to execute the callbacks
  goal.send();
}

function go_home() {
  console.log("Sending waypoint to robot:" + 
              "\n\tx: " + 0 + 
              "\n\ty: " + 0 +
              "\n\tyaw: " + 0);

  //Create the goal
  const goal = new ROSLIB.Goal({
    actionClient : controlClient,
    goalMessage : {
      target_pose : {
        header : {
          frame_id : "robot_1/map"
        },
        pose : {
          position : {
            x: 0,
            y: 0,
            z: .263
          },
          orientation : {
            x: 0,
            y: 0,
            z: 0,
            w: 1
          }
        }
      }
    }
  });

  //Send the goal to the server to execute the callbacks
  goal.send();
}