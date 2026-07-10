package otp

type SendOTPRequest struct {
	Target     string `json:"target" validate:"required"`
	TargetType string `json:"target_type" validate:"required,oneof=EMAIL SMS email sms"`
	OtpType    string `json:"otp_type"`
	TTLMinutes int    `json:"ttl_minutes" validate:"omitempty,min=1,max=60"`
}

type VerifyOTPRequest struct {
	Target     string `json:"target" validate:"required"`
	TargetType string `json:"target_type" validate:"required,oneof=EMAIL SMS email sms"`
	OtpType    string `json:"otp_type"`
	Code       string `json:"code" validate:"required,len=6"`
}

type OTPResponse struct {
	Message string `json:"message"`
}
