use actix_web::{
    HttpResponse, HttpRequest, HttpMessage, delete, get, post, put,
    web::{self, Json, Path, Query},
};
use dto::{
    games::{
        CreateGameRequest, MakeMoveRequest, JoinGameRequest,
        GameStatus, ListGamesQuery, ImportGameRequest, ImportGameResponse,
        CompleteGameRequest, CompleteGameResponse,
    },
};
use error::error::ApiError;
use serde_json::json;
use validator::Validate;
use uuid::Uuid;
use sea_orm::DatabaseConnection;
use service::games::GameService;

// ---------------------------------------------------------------------------
// Helper: extract authenticated player UUID inserted by the JWT middleware.
// ---------------------------------------------------------------------------
fn authenticated_player(req: &HttpRequest) -> Result<Uuid, HttpResponse> {
    req.extensions()
        .get::<Uuid>()
        .copied()
        .ok_or_else(|| {
            HttpResponse::Unauthorized().json(json!({
                "message": "Authentication required"
            }))
        })
}

// ---------------------------------------------------------------------------
// POST /v1/games
// ---------------------------------------------------------------------------
#[post("")]
pub async fn create_game(
    req: HttpRequest,
    payload: Json<CreateGameRequest>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    if let Err(errors) = payload.0.validate() {
        return ApiError::ValidationError(errors).error_response();
    }

    let creator_id = match authenticated_player(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    match GameService::create_game(db.get_ref(), creator_id, payload.0).await {
        Ok(game_dto) => HttpResponse::Created().json(json!({
            "message": "Game created successfully",
            "data": { "game": game_dto }
        })),
        Err(e) => {
            eprintln!("create_game error: {e}");
            HttpResponse::InternalServerError().json(json!({
                "message": "Failed to create game"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// GET /v1/games/{id}
// ---------------------------------------------------------------------------
#[get("/{id}")]
pub async fn get_game(
    id: Path<Uuid>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let game_id = id.into_inner();

    match GameService::get_game(db.get_ref(), game_id).await {
        Ok(game_dto) => HttpResponse::Ok().json(json!({
            "message": "Game found",
            "data": { "game": game_dto }
        })),
        Err(ApiError::NotFound(_)) => HttpResponse::NotFound().json(json!({
            "message": "Game not found"
        })),
        Err(e) => {
            eprintln!("get_game error: {e}");
            HttpResponse::InternalServerError().json(json!({
                "message": "Failed to fetch game"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /v1/games/{id}/move
// ---------------------------------------------------------------------------
#[put("/{id}/move")]
pub async fn make_move(
    req: HttpRequest,
    id: Path<Uuid>,
    payload: Json<MakeMoveRequest>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    if let Err(errors) = payload.0.validate() {
        return ApiError::ValidationError(errors).error_response();
    }

    let player_id = match authenticated_player(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let game_id = id.into_inner();

    match GameService::make_move(db.get_ref(), game_id, player_id, payload.0).await {
        Ok(game_dto) => HttpResponse::Ok().json(json!({
            "message": "Move made successfully",
            "data": { "game": game_dto }
        })),
        Err(ApiError::NotFound(_)) => HttpResponse::NotFound().json(json!({
            "message": "Game not found"
        })),
        Err(ApiError::BadRequest(msg)) => HttpResponse::BadRequest().json(json!({
            "message": msg
        })),
        Err(ApiError::Forbidden(_)) => HttpResponse::Forbidden().json(json!({
            "message": "It is not your turn"
        })),
        Err(e) => {
            eprintln!("make_move error: {e}");
            HttpResponse::InternalServerError().json(json!({
                "message": "Failed to apply move"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// GET /v1/games
// ---------------------------------------------------------------------------
#[get("")]
pub async fn list_games(
    query: Query<ListGamesQuery>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let status_enum: Option<GameStatus> = query.status.as_deref().and_then(|s| match s {
        "waiting"     => Some(GameStatus::Waiting),
        "in_progress" => Some(GameStatus::InProgress),
        "completed"   => Some(GameStatus::Completed),
        "aborted"     => Some(GameStatus::Aborted),
        _             => None,
    });

    let limit  = query.limit.unwrap_or(10);
    let cursor = query.cursor.clone();

    match GameService::list_games(
        db.get_ref(),
        cursor,
        limit,
        query.player_id,
        status_enum,
    )
    .await
    {
        Ok((games, next_cursor)) => {
            let game_dtos: Vec<serde_json::Value> = games
                .into_iter()
                .map(|g| {
                    let status = match &g.result {
                        Some(db_entity::game::ResultSide::Ongoing) => "in_progress",
                        Some(_) => "completed",
                        None => "waiting",
                    };
                    json!({
                        "id":              g.id,
                        "white_player_id": g.white_player,
                        "black_player_id": g.black_player,
                        "status":          status,
                        "result":          g.result,
                        "current_fen":     g.fen,
                        "created_at":      g.created_at,
                        "started_at":      g.started_at,
                    })
                })
                .collect();

            HttpResponse::Ok().json(json!({
                "message": "Games found",
                "data": {
                    "games":       game_dtos,
                    "next_cursor": next_cursor,
                    "limit":       limit,
                }
            }))
        }
        Err(e) => {
            eprintln!("list_games error: {e}");
            HttpResponse::InternalServerError().json(json!({
                "message": "Failed to list games"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// POST /v1/games/{id}/join
// ---------------------------------------------------------------------------
#[post("/{id}/join")]
pub async fn join_game(
    req: HttpRequest,
    id: Path<Uuid>,
    payload: Json<JoinGameRequest>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    if let Err(errors) = payload.0.validate() {
        return ApiError::ValidationError(errors).error_response();
    }

    // Prefer JWT-extracted id; fall back to body field so the DTO stays intact.
    let player_id = authenticated_player(&req).unwrap_or(payload.0.player_id);
    let game_id   = id.into_inner();

    match GameService::join_game(db.get_ref(), game_id, player_id).await {
        Ok(game_dto) => HttpResponse::Ok().json(json!({
            "message": "Joined game successfully",
            "data": { "game": game_dto }
        })),
        Err(ApiError::NotFound(_)) => HttpResponse::NotFound().json(json!({
            "message": "Game not found"
        })),
        Err(ApiError::BadRequest(msg)) => HttpResponse::BadRequest().json(json!({
            "message": msg
        })),
        Err(e) => {
            eprintln!("join_game error: {e}");
            HttpResponse::InternalServerError().json(json!({
                "message": "Failed to join game"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /v1/games/{id}
// ---------------------------------------------------------------------------
#[delete("/{id}")]
pub async fn abandon_game(
    id: Path<Uuid>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    let game_id = id.into_inner();

    match GameService::abandon_game(db.get_ref(), game_id, Uuid::new_v4()).await {
        Ok(_) => HttpResponse::Ok().json(json!({
            "message": "Game abandoned successfully",
            "data": {}
        })),
        Err(ApiError::NotFound(_)) => HttpResponse::NotFound().json(json!({
            "message": "Game not found"
        })),
        Err(ApiError::Forbidden(_)) => HttpResponse::Forbidden().json(json!({
            "message": "You are not a participant in this game"
        })),
        Err(e) => {
            eprintln!("abandon_game error: {e}");
            HttpResponse::InternalServerError().json(json!({
                "message": "Failed to abandon game"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// POST /v1/games/import
// ---------------------------------------------------------------------------
#[post("/import")]
pub async fn import_game(
    req: HttpRequest,
    payload: Json<ImportGameRequest>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    if let Err(errors) = payload.0.validate() {
        return ApiError::ValidationError(errors).error_response();
    }

    let importer_id = match authenticated_player(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    // Parse PGN.
    let parsed = match chess::parse_pgn(&payload.pgn) {
        Ok(p) => p,
        Err(e) => {
            return HttpResponse::BadRequest().json(ImportGameResponse {
                success:      false,
                game_id:      None,
                white_player: String::new(),
                black_player: String::new(),
                result:       String::new(),
                move_count:   0,
                final_fen:    None,
                error:        Some(e.to_string()),
            });
        }
    };

    // Validate move legality.
    let validated = match chess::validate_game(&parsed) {
        Ok(v) => v,
        Err(e) => {
            return HttpResponse::UnprocessableEntity().json(ImportGameResponse {
                success:      false,
                game_id:      None,
                white_player: parsed.headers.white.clone(),
                black_player: parsed.headers.black.clone(),
                result:       String::new(),
                move_count:   0,
                final_fen:    None,
                error:        Some(e.to_string()),
            });
        }
    };

    let result_str = validated.headers.result.to_pgn_string().to_string();

    // Persist in DB with is_imported = true.
    match GameService::import_game(db.get_ref(), importer_id, &validated).await {
        Ok(game_id) => HttpResponse::Created().json(ImportGameResponse {
            success:      true,
            game_id:      Some(game_id),
            white_player: validated.headers.white,
            black_player: validated.headers.black,
            result:       result_str,
            move_count:   validated.ply_count,
            final_fen:    Some(validated.final_fen),
            error:        None,
        }),
        Err(e) => {
            eprintln!("import_game DB error: {e}");
            HttpResponse::InternalServerError().json(ImportGameResponse {
                success:      false,
                game_id:      None,
                white_player: validated.headers.white,
                black_player: validated.headers.black,
                result:       result_str,
                move_count:   validated.ply_count,
                final_fen:    Some(validated.final_fen),
                error:        Some(e.to_string()),
            })
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /v1/games/{id}/complete
// ---------------------------------------------------------------------------
#[put("/{id}/complete")]
pub async fn complete_game(
    req: HttpRequest,
    id: Path<Uuid>,
    payload: Json<CompleteGameRequest>,
    db: web::Data<DatabaseConnection>,
) -> HttpResponse {
    if let Err(errors) = payload.0.validate() {
        return ApiError::ValidationError(errors).error_response();
    }

    let _player_id = match authenticated_player(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let game_id = id.into_inner();

    // Parse result string to enum
    let result_enum = match payload.result.as_str() {
        "white_wins" => db_entity::game::ResultSide::WhiteWins,
        "black_wins" => db_entity::game::ResultSide::BlackWins,
        "draw" => db_entity::game::ResultSide::Draw,
        "abandoned" => db_entity::game::ResultSide::Abandoned,
        _ => {
            return HttpResponse::BadRequest().json(json!({
                "message": "Invalid result. Must be one of: white_wins, black_wins, draw, abandoned"
            }));
        }
    };

    // Create rating config with custom K-factor if provided
    let rating_config = chess::RatingConfig {
        k_factor: payload.k_factor.unwrap_or(32),
        ..Default::default()
    };

    // Get current ratings before update for calculating changes
    let white_old_rating = match service::games::GameService::get_player_rating_for_game(
        db.get_ref(), 
        game_id, 
        true // white player
    ).await {
        Ok(rating) => rating,
        Err(e) => {
            eprintln!("Failed to get white player rating: {e}");
            return HttpResponse::InternalServerError().json(json!({
                "message": "Failed to get player ratings"
            }));
        }
    };

    let black_old_rating = match service::games::GameService::get_player_rating_for_game(
        db.get_ref(), 
        game_id, 
        false // black player
    ).await {
        Ok(rating) => rating,
        Err(e) => {
            eprintln!("Failed to get black player rating: {e}");
            return HttpResponse::InternalServerError().json(json!({
                "message": "Failed to get player ratings"
            }));
        }
    };

    // Complete game and update ratings
    match GameService::complete_game(db.get_ref(), game_id, result_enum.clone(), Some(rating_config)).await {
        Ok((white_new_rating, black_new_rating)) => {
            let white_change = white_new_rating - white_old_rating;
            let black_change = black_new_rating - black_old_rating;

            HttpResponse::Ok().json(CompleteGameResponse {
                success: true,
                game_id,
                result: payload.result.clone(),
                white_new_rating,
                black_new_rating,
                rating_change_white: white_change,
                rating_change_black: black_change,
                error: None,
            })
        }
        Err(ApiError::NotFound(_)) => HttpResponse::NotFound().json(CompleteGameResponse {
            success: false,
            game_id,
            result: payload.result.clone(),
            white_new_rating: white_old_rating,
            black_new_rating: black_old_rating,
            rating_change_white: 0,
            rating_change_black: 0,
            error: Some("Game not found".to_string()),
        }),
        Err(ApiError::BadRequest(msg)) => HttpResponse::BadRequest().json(CompleteGameResponse {
            success: false,
            game_id,
            result: payload.result.clone(),
            white_new_rating: white_old_rating,
            black_new_rating: black_old_rating,
            rating_change_white: 0,
            rating_change_black: 0,
            error: Some(msg),
        }),
        Err(e) => {
            eprintln!("complete_game error: {e}");
            HttpResponse::InternalServerError().json(CompleteGameResponse {
                success: false,
                game_id,
                result: payload.result.clone(),
                white_new_rating: white_old_rating,
                black_new_rating: black_old_rating,
                rating_change_white: 0,
                rating_change_black: 0,
                error: Some("Failed to complete game and update ratings".to_string()),
            })
        }
    }
}