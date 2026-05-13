from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


def create_engine() -> AsyncEngine:
    return create_async_engine(
        settings.sqlalchemy_database_uri_async,
        echo=settings.sqlalchemy_echo,
        pool_pre_ping=settings.sqlalchemy_pool_pre_ping,
    )


engine = create_engine()
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
