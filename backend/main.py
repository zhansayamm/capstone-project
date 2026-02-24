from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from uuid import uuid4
import h3

app = FastAPI()

# -----------------------------
# In-memory storage (fake DB)
# -----------------------------
users = []
assets = []
incidents = []
audit_logs = []

# -----------------------------
# Schemas
# -----------------------------

class User(BaseModel):
    name: str
    email: str
    role: str
    region: str

class Asset(BaseModel):
    name: str
    type: str
    latitude: float
    longitude: float
    status: str
    created_by: str

class Incident(BaseModel):
    asset_id: str
    description: str
    severity: str
    latitude: float
    longitude: float
    reported_by: str

# =====================================================
# USERS CRUD
# =====================================================

@app.post("/users")
def create_user(user: User):
    new_user = user.dict()
    new_user["id"] = str(uuid4())
    users.append(new_user)
    return new_user

@app.get("/users")
def get_users():
    return users

@app.get("/users/{user_id}")
def get_user(user_id: str):
    for user in users:
        if user["id"] == user_id:
            return user
    raise HTTPException(status_code=404, detail="User not found")

@app.put("/users/{user_id}")
def update_user(user_id: str, updated_user: User):
    for user in users:
        if user["id"] == user_id:
            user.update(updated_user.dict())
            return user
    raise HTTPException(status_code=404, detail="User not found")

@app.delete("/users/{user_id}")
def delete_user(user_id: str):
    for user in users:
        if user["id"] == user_id:
            users.remove(user)
            return {"message": "User deleted"}
    raise HTTPException(status_code=404, detail="User not found")


# =====================================================
# ASSETS CRUD (WITH H3)
# =====================================================

@app.post("/assets")
def create_asset(asset: Asset):
    h3_index = h3.geo_to_h3(asset.latitude, asset.longitude, 8)

    new_asset = asset.dict()
    new_asset["id"] = str(uuid4())
    new_asset["h3_index"] = h3_index

    assets.append(new_asset)

    audit_logs.append({
        "action": "CREATE_ASSET",
        "entity_id": new_asset["id"]
    })

    return new_asset

@app.get("/assets")
def get_assets():
    return assets

@app.get("/assets/{asset_id}")
def get_asset(asset_id: str):
    for asset in assets:
        if asset["id"] == asset_id:
            return asset
    raise HTTPException(status_code=404, detail="Asset not found")

@app.put("/assets/{asset_id}")
def update_asset(asset_id: str, updated_asset: Asset):
    for asset in assets:
        if asset["id"] == asset_id:
            asset.update(updated_asset.dict())
            return asset
    raise HTTPException(status_code=404, detail="Asset not found")

@app.delete("/assets/{asset_id}")
def delete_asset(asset_id: str):
    for asset in assets:
        if asset["id"] == asset_id:
            assets.remove(asset)

            audit_logs.append({
                "action": "DELETE_ASSET",
                "entity_id": asset_id
            })

            return {"message": "Asset deleted"}
    raise HTTPException(status_code=404, detail="Asset not found")


# -----------------------------
# H3 REGION QUERY
# -----------------------------

@app.get("/assets/by-h3/{h3_index}")
def get_assets_by_region(h3_index: str):
    return [a for a in assets if a["h3_index"] == h3_index]


@app.get("/assets/near")
def get_near_assets(lat: float, lng: float):
    center = h3.geo_to_h3(lat, lng, 8)
    neighbors = h3.k_ring(center, 1)

    return [a for a in assets if a["h3_index"] in neighbors]


# =====================================================
# INCIDENTS CRUD
# =====================================================

@app.post("/incidents")
def create_incident(incident: Incident):
    h3_index = h3.geo_to_h3(incident.latitude, incident.longitude, 8)

    new_incident = incident.dict()
    new_incident["id"] = str(uuid4())
    new_incident["h3_index"] = h3_index

    incidents.append(new_incident)

    audit_logs.append({
        "action": "CREATE_INCIDENT",
        "entity_id": new_incident["id"]
    })

    return new_incident

@app.get("/incidents")
def get_incidents():
    return incidents

@app.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    for incident in incidents:
        if incident["id"] == incident_id:
            return incident
    raise HTTPException(status_code=404, detail="Incident not found")

@app.put("/incidents/{incident_id}")
def update_incident(incident_id: str, updated_incident: Incident):
    for incident in incidents:
        if incident["id"] == incident_id:
            incident.update(updated_incident.dict())
            return incident
    raise HTTPException(status_code=404, detail="Incident not found")

@app.delete("/incidents/{incident_id}")
def delete_incident(incident_id: str):
    for incident in incidents:
        if incident["id"] == incident_id:
            incidents.remove(incident)
            return {"message": "Incident deleted"}
    raise HTTPException(status_code=404, detail="Incident not found")


# =====================================================
# ANALYTICS
# =====================================================

@app.get("/analytics/region-summary")
def region_summary():
    summary = {}

    for asset in assets:
        h3_index = asset["h3_index"]
        summary[h3_index] = summary.get(h3_index, 0) + 1

    return summary


# =====================================================
# AUDIT LOGS
# =====================================================

@app.get("/audit/logs")
def get_audit_logs():
    return audit_logs