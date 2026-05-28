import os
import tempfile
import uuid
from abc import ABC, abstractmethod

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv

load_dotenv()

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "s3").lower()
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


class StorageBackend(ABC):
    @abstractmethod
    def save(self, file_bytes: bytes, filename: str, user_id: int, content_type: str) -> str:
        """Persist file and return a storage key/path."""

    @abstractmethod
    def get_local_path(self, storage_key: str) -> str:
        """Return a local filesystem path suitable for parsing."""


class LocalStorageBackend(StorageBackend):
    def save(self, file_bytes: bytes, filename: str, user_id: int, content_type: str) -> str:
        del content_type
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        safe_name = f"{user_id}_{uuid.uuid4().hex}_{filename}"
        file_path = os.path.join(UPLOAD_DIR, safe_name)
        with open(file_path, "wb") as buffer:
            buffer.write(file_bytes)
        return file_path

    def get_local_path(self, storage_key: str) -> str:
        return storage_key


class S3StorageBackend(StorageBackend):
    def __init__(self):
        self.bucket = os.getenv("AWS_S3_BUCKET")
        self.region = os.getenv("AWS_REGION", "us-east-1")
        if not self.bucket:
            raise ValueError("AWS_S3_BUCKET is required when STORAGE_BACKEND=s3")

        self.client = boto3.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )

    def _object_key(self, filename: str, user_id: int) -> str:
        return f"users/{user_id}/{uuid.uuid4().hex}/{filename}"

    def save(self, file_bytes: bytes, filename: str, user_id: int, content_type: str) -> str:
        key = self._object_key(filename, user_id)
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
        except (BotoCoreError, ClientError) as error:
            raise RuntimeError(f"Failed to upload to S3: {error}") from error
        return f"s3://{self.bucket}/{key}"

    def get_local_path(self, storage_key: str) -> str:
        if not storage_key.startswith("s3://"):
            return storage_key

        _, _, bucket_and_key = storage_key.partition("s3://")
        bucket, _, key = bucket_and_key.partition("/")

        suffix = os.path.splitext(key)[1] or ".bin"
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file.close()

        try:
            self.client.download_file(bucket, key, temp_file.name)
        except (BotoCoreError, ClientError) as error:
            os.unlink(temp_file.name)
            raise RuntimeError(f"Failed to download from S3: {error}") from error

        return temp_file.name


def get_storage_backend() -> StorageBackend:
    if STORAGE_BACKEND == "s3" and os.getenv("AWS_S3_BUCKET"):
        return S3StorageBackend()
    return LocalStorageBackend()
