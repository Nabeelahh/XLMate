use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;
use chrono::{DateTime, Utc};


#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MatchType {
    Rated,
    Casual,
    Private,
}

impl MatchType {
    pub fn redis_key(&self) -> String {
        match self {
            MatchType::Rated => "matchmaking:queue:rated".to_string(),
            MatchType::Casual => "matchmaking:queue:casual".to_string(),
            MatchType::Private => "matchmaking:invites".to_string(),
        }
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub wallet_address: String,
    pub elo: u32,
    pub join_time: DateTime<Utc>, 
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchRequest {
    pub id: Uuid,
    pub player: Player,
    pub match_type: MatchType,
    pub invite_address: Option<String>, // For private matches__
    pub max_elo_diff: Option<u32>,      // For rated matches__
}

impl MatchRequest {
    pub fn to_redis_value(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    pub fn from_redis_value(s: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(s)
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Match {
    pub id: Uuid,
    pub player1: Player,
    pub player2: Player,
    pub match_type: MatchType,
    pub created_at: DateTime<Utc>, 
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStatus {
    pub request_id: Uuid,
    pub position: usize,
    pub estimated_wait_time: Duration,
    pub match_type: MatchType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchmakingResponse {
    pub status: String,
    pub match_id: Option<Uuid>,
    pub request_id: Uuid,
}