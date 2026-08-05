pub mod classify;
pub mod events;
pub mod types;

pub use events::*;
pub use types::*;

// ── Score tiers ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum ScoreTier {
    Verified    = 0,
    Established = 1,
    Advanced    = 2,
    Elite       = 3,
    Apex        = 4,
}

impl ScoreTier {
    pub fn from_score(score: u32) -> Self {
        match score {
            250..=499 => Self::Established,
            500..=749 => Self::Advanced,
            750..=949 => Self::Elite,
            950..=1000 => Self::Apex,
            _ => Self::Verified,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Verified    => "Verified",
            Self::Established => "Established",
            Self::Advanced    => "Advanced",
            Self::Elite       => "Elite",
            Self::Apex        => "Apex",
        }
    }
}

impl std::fmt::Display for ScoreTier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}
