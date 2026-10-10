from sqlalchemy import Column, Integer, String, Boolean
from .database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    completed = Column(Boolean, default=False)
    reminder_time = Column(String, nullable=True)
    priority = Column(String, default="Medium")
    category = Column(String, default="Personal")
    recurrence = Column(String, default="none")
    subtasks = Column(String, default="[]")