package server

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAudienceFromScope(t *testing.T) {
	tests := []struct {
		scope    string
		expected string
	}{
		{"ROLE_RECRUITER recruiter:write", "web-vendor"},
		{"ROLE_RECRUITER", "web-vendor"},
		{"role_recruiter", "web-vendor"},
		{"ROLE_ADMIN", "web-admin"},
		{"role_admin", "web-admin"},
		{"ROLE_CANDIDATE", "web-user"},
		{"role_candidate", "web-user"},
		{"", "web-user"},
		{"ROLE_UNKNOWN", "web-user"},
	}
	for _, tt := range tests {
		t.Run(tt.scope, func(t *testing.T) {
			assert.Equal(t, tt.expected, audienceFromScope(tt.scope))
		})
	}
}

// TestAudienceFromScope_CaseInsensitive verifies scope matching is case-insensitive;
// the gateway may forward the scope claim in any casing.
func TestAudienceFromScope_CaseInsensitive(t *testing.T) {
	scopes := []string{"ROLE_RECRUITER", "role_recruiter", "Role_Recruiter", "rOlE_rEcRuItEr"}
	for _, s := range scopes {
		assert.Equal(t, "web-vendor", audienceFromScope(s),
			"should match web-vendor for any casing of ROLE_RECRUITER")
	}
}
