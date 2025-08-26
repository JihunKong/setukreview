# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a school record checking assistant that processes Excel files downloaded from NEIS (Korean education system). The project aims to detect errors in student records without modifying them, focusing on:

- Automated validation of Korean school records
- AI-powered verification using GPT-5-mini
- Detection of formatting, grammar, and content rule violations
- Railway deployment with automatic CI/CD

## Development Architecture

### Core Files
- `1234.xlsm`: Original Excel VBA file containing validation logic
- `README.md`: Comprehensive project requirements and validation rules

### Deployment
- **Platform**: Railway
- **Deployment**: Automatic deployment on git push
- **Environment**: https://railway.com/project/3aa09973-edf6-47dd-86f3-45724f7e438f/service/3cdb4886-2dbd-458b-b510-0104f058eccf?open=true

### Backend Design
- Use Railway CLI for backend setup
- Design backend architecture from scratch based on requirements
- Implement file upload and processing pipeline
- AI integration for content validation

## Validation Rules Implementation

### Primary Validation Categories
1. **Korean/English Input Rules**: Validate proper use of Korean text with limited English exceptions
2. **Institution Name Rules**: Detect and flag unauthorized institution names with educational exceptions
3. **Grammar & Format Checks**: Period validation, quotation marks, special characters, spacing, English expressions
4. **Content Rules**: Instructor names, proper terminology usage

### Key Features to Implement
- Excel file upload processing
- Error detection and location reporting
- Output formatting for review
- AI-powered content verification
- No modification - detection only

## File Processing
- Input: Excel files from NEIS system
- Output: Formatted error reports with specific location information
- Processing: VBA logic analysis and conversion to web-based system
- 레일웨이 프로젝트 아이디 3aa09973-edf6-47dd-86f3-45724f7e438f
- setukreview-production.up.railway.app:8080