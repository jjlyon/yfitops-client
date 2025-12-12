extends Node2D

@export var ball_path: NodePath
@export var impulse: Vector2 = Vector2(0, -300.0)
@export var tilt_threshold: int = 3
@export var tilt_window: float = 1.5
@export var tilt_duration: float = 2.0

var _nudge_count: int = 0
var _tilted: bool = false
@onready var _ball: RigidBody2D = get_node_or_null(ball_path)
@onready var _tilt_timer: Timer = $TiltTimer
@onready var _nudge_timer: Timer = $NudgeWindow

func _ready() -> void:
  _tilt_timer.wait_time = tilt_duration
  _nudge_timer.wait_time = tilt_window
  _tilt_timer.timeout.connect(_on_tilt_timeout)
  _nudge_timer.timeout.connect(_on_nudge_window_timeout)

func _physics_process(_delta: float) -> void:
  if Input.is_action_just_pressed("nudge"):
    _apply_nudge()

func _apply_nudge() -> void:
  if _tilted:
    return
  if _ball:
    _ball.apply_impulse(impulse)
  _nudge_count += 1
  _nudge_timer.start()
  if _nudge_count >= tilt_threshold:
    _trigger_tilt()

func _trigger_tilt() -> void:
  _tilted = true
  _nudge_count = 0
  if Engine.has_singleton("EventBus"):
    Engine.get_singleton("EventBus").start_tilt(tilt_duration)
  _tilt_timer.start()

func _on_tilt_timeout() -> void:
  _tilted = false
  if Engine.has_singleton("EventBus"):
    Engine.get_singleton("EventBus").clear_tilt()

func _on_nudge_window_timeout() -> void:
  _nudge_count = 0
