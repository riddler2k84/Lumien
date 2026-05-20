from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class RoomType(Base):
    __tablename__ = "room_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)

    rooms = relationship("Room", back_populates="room_type")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_type_id = Column(Integer, ForeignKey("room_types.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    capacity = Column(Integer, nullable=False)
    floor = Column(String(20))
    building = Column(String(100))
    is_active = Column(Boolean, default=True, nullable=False)

    room_type = relationship("RoomType", back_populates="rooms")
    facilities = relationship("RoomFacility", back_populates="room")
    schedule_entries = relationship("ScheduleEntry", back_populates="room")


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)

    room_facilities = relationship("RoomFacility", back_populates="facility")
    subject_requirements = relationship("SubjectRequirement", back_populates="facility")


class RoomFacility(Base):
    __tablename__ = "room_facilities"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)

    room = relationship("Room", back_populates="facilities")
    facility = relationship("Facility", back_populates="room_facilities")
