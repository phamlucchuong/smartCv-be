package sms

import (
	"context"
	"fmt"
	"strings"

	awsv2 "github.com/aws/aws-sdk-go-v2/aws"
	awssdkconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	snstypes "github.com/aws/aws-sdk-go-v2/service/sns/types"
)

type SNSProvider struct {
	client            *sns.Client
	senderID          string
	maxPriceUSD       string
	smsType           string
	originationNumber string
	entityID          string
	templateID        string
}

func NewSNSProvider(
	ctx context.Context,
	region string,
	senderID string,
	maxPriceUSD string,
	smsType string,
	originationNumber string,
	entityID string,
	templateID string,
) *SNSProvider {
	if strings.TrimSpace(region) == "" {
		return nil
	}

	cfg, err := awssdkconfig.LoadDefaultConfig(ctx, awssdkconfig.WithRegion(region))
	if err != nil {
		return nil
	}

	return &SNSProvider{
		client:            sns.NewFromConfig(cfg),
		senderID:          strings.TrimSpace(senderID),
		maxPriceUSD:       strings.TrimSpace(maxPriceUSD),
		smsType:           strings.TrimSpace(smsType),
		originationNumber: strings.TrimSpace(originationNumber),
		entityID:          strings.TrimSpace(entityID),
		templateID:        strings.TrimSpace(templateID),
	}
}

func (p *SNSProvider) SendOTP(ctx context.Context, to string, code string, ttlMinutes int) error {
	message := fmt.Sprintf("Ma xac thuc Smart CV cua ban la: %s. Ma co hieu luc trong %d phut.", code, ttlMinutes)

	input := &sns.PublishInput{
		PhoneNumber: awsv2.String(formatPhoneNumber(to)),
		Message:     awsv2.String(message),
	}

	attrs := map[string]snstypes.MessageAttributeValue{}
	if p.senderID != "" {
		attrs["AWS.SNS.SMS.SenderID"] = snstypes.MessageAttributeValue{
			DataType:    awsv2.String("String"),
			StringValue: awsv2.String(p.senderID),
		}
	}
	if p.maxPriceUSD != "" {
		attrs["AWS.SNS.SMS.MaxPrice"] = snstypes.MessageAttributeValue{
			DataType:    awsv2.String("Number"),
			StringValue: awsv2.String(p.maxPriceUSD),
		}
	}
	if p.smsType != "" {
		attrs["AWS.SNS.SMS.SMSType"] = snstypes.MessageAttributeValue{
			DataType:    awsv2.String("String"),
			StringValue: awsv2.String(p.smsType),
		}
	}
	if p.originationNumber != "" {
		attrs["AWS.MM.SMS.OriginationNumber"] = snstypes.MessageAttributeValue{
			DataType:    awsv2.String("String"),
			StringValue: awsv2.String(p.originationNumber),
		}
	}
	if p.entityID != "" {
		attrs["AWS.MM.SMS.EntityId"] = snstypes.MessageAttributeValue{
			DataType:    awsv2.String("String"),
			StringValue: awsv2.String(p.entityID),
		}
	}
	if p.templateID != "" {
		attrs["AWS.MM.SMS.TemplateId"] = snstypes.MessageAttributeValue{
			DataType:    awsv2.String("String"),
			StringValue: awsv2.String(p.templateID),
		}
	}
	if len(attrs) > 0 {
		input.MessageAttributes = attrs
	}

	if _, err := p.client.Publish(ctx, input); err != nil {
		return fmt.Errorf("aws sns send sms: %w", err)
	}

	return nil
}
