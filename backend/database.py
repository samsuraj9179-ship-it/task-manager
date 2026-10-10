from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

SQLALCHEMY_DATABASE_URL = "sqlite:///./tasks.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def run_migrations(engine):
    with engine.connect() as conn:
        for sql in [
            "ALTER TABLE tasks ADD COLUMN reminder_time TEXT",
            "ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'Medium'",
            "ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT 'Personal'",
            "ALTER TABLE tasks ADD COLUMN recurrence TEXT DEFAULT 'none'",
            "ALTER TABLE tasks ADD COLUMN subtasks TEXT DEFAULT '[]'",
        ]:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()