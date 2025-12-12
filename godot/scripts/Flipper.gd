extends Node2D

@export var action_name: String = "left_flipper"
@export var rest_angle: float = -0.3
@export var active_angle: float = 0.45
@export var rotation_speed: float = 12.0

var _locked: bool = false
var _target_angle: float = rest_angle

func _ready() -> void:
  if Engine.is_editor_hint():
    return
  if Engine.has_singleton("EventBus"):
    var bus = Engine.get_singleton("EventBus")
    bus.tilt_started.connect(_on_tilt_started)
    bus.tilt_cleared.connect(_on_tilt_cleared)

func _physics_process(delta: float) -> void:
  if _locked:
    _target_angle = rest_angle
  else:
    var is_active := Input.is_action_pressed(action_name)
    _target_angle = active_angle if is_active else rest_angle
  rotation = lerp_angle(rotation, _target_angle, delta * rotation_speed)

func _on_tilt_started(duration: float) -> void:
  _locked = true

func _on_tilt_cleared() -> void:
  _locked = false
