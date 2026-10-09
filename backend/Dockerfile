# Use the lightweight Python 3.12 image
FROM python:3.12-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the dependency ledger and install packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code
COPY . /app

# Expose the Flask port
EXPOSE 5000

# Launch the Flask development server
CMD ["flask", "run", "--host=0.0.0.0"]