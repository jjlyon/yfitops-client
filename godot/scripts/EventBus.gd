extends Node

signal tilt_started(duration)
signal tilt_cleared

func start_tilt(duration: float) -> void:
  tilt_started.emit(duration)

func clear_tilt() -> void:
  tilt_cleared.emit()
