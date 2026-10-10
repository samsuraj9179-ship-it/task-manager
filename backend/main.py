from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from . import models, database

models.Base.metadata.create_all(bind=database.engine)
database.run_migrations(database.engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "Medium"
    category: Optional[str] = "Personal"
    recurrence: Optional[str] = "none"
    subtasks: Optional[str] = "[]"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    reminder_time: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    recurrence: Optional[str] = None
    subtasks: Optional[str] = None

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    completed: bool
    reminder_time: Optional[str] = None
    priority: Optional[str] = "Medium"
    category: Optional[str] = "Personal"
    recurrence: Optional[str] = "none"
    subtasks: Optional[str] = "[]"

    class Config:
        from_attributes = True

@app.get("/tasks", response_model=list[TaskResponse])
def get_tasks(db: Session = Depends(database.get_db)):
    return db.query(models.Task).all()

@app.post("/tasks", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(database.get_db)):
    db_task = models.Task(
        title=task.title,
        description=task.description,
        priority=task.priority or "Medium",
        category=task.category or "Personal",
        recurrence=task.recurrence or "none",
        subtasks=task.subtasks or "[]"
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(database.get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task_update.title is not None:
        task.title = task_update.title
    if task_update.description is not None:
        task.description = task_update.description
    if task_update.completed is not None:
        task.completed = task_update.completed
    if task_update.reminder_time is not None:
        task.reminder_time = task_update.reminder_time
    elif 'reminder_time' in task_update.model_fields_set:
        task.reminder_time = None
    if task_update.priority is not None:
        task.priority = task_update.priority
    if task_update.category is not None:
        task.category = task_update.category
    if task_update.recurrence is not None:
        task.recurrence = task_update.recurrence
    if task_update.subtasks is not None:
        task.subtasks = task_update.subtasks
    db.commit()
    db.refresh(task)
    return task

@app.delete("/tasks/completed")
def clear_completed(db: Session = Depends(database.get_db)):
    deleted = db.query(models.Task).filter(models.Task.completed == True).delete()
    db.commit()
    return {"message": f"Deleted {deleted} completed tasks"}

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(database.get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}