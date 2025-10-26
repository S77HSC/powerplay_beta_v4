from roboflow import Roboflow

rf = Roboflow(api_key="FIkJH30aO7eg73oaSI0X")
project = rf.workspace("football-detection-model").project("football-detection-6vezx")
version = project.version(4)
dataset = version.download("yolov8")
